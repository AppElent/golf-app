import type { ExportStep } from "@fairway/core/data-export";
import { ConvexError, v } from "convex/values";
import type { TableNames } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { exportStep } from "./account";
import { getOptionalUserId } from "./lib";
import { loose, OWNED_TABLES, type Owned, USER_DATA } from "./userData";

/**
 * The AppElent account portal contract (developer-home
 * `standards/account-portal.md`, contract 1): account.appelent.nl opens a
 * Convex client with the shared Clerk token and calls these to show and
 * export what Fairway holds for the signed-in person. Each function reads the
 * caller from the token only and wraps the registry in `userData.ts` and the
 * in-app export (`account.exportPage`); none writes. `deleteAppData` follows
 * once APP-392 lands.
 */

const CONTRACT = 1;
const APP = "fairway";

/** The most rows one count reads; `more` means "this many or more". */
const COUNT_CAP = 1000;

/**
 * The portal's stable key per owned table, in display order. Exactly the
 * registry's owned tables, each once (`functions.test.ts` compares the sets);
 * the portal owns the labels.
 */
export const COUNT_KEYS: readonly { table: TableNames; key: string }[] = [
	{ table: "rounds", key: "rounds" },
	{ table: "shots", key: "shots" },
	{ table: "clubs", key: "clubs" },
	{ table: "courses", key: "courseCopies" },
	{ table: "courseSuggestions", key: "courseSuggestions" },
	{ table: "userSettings", key: "settings" },
];

export interface PortalCount {
	key: string;
	count: number;
	more: boolean;
}

export interface PortalSummary {
	contract: typeof CONTRACT;
	/** Fairway stores no last-write time, so this is always null. */
	lastActiveAt: null;
	counts: PortalCount[];
}

/**
 * The caller's rows per kind, or null when Fairway holds nothing for them.
 * Child rows (scores, holes) hang under owned rows, so all-zero owned counts
 * mean no data at all. Reads at most 1,001 small rows per owned table.
 */
export const summary = query({
	args: {},
	handler: async (ctx): Promise<PortalSummary | null> => {
		const userId = await getOptionalUserId(ctx);
		if (!userId) return null;
		const counts = await Promise.all(
			COUNT_KEYS.map(async ({ table, key }) => {
				const rows = await countOwned(ctx, table, userId);
				return {
					key,
					count: Math.min(rows, COUNT_CAP),
					more: rows > COUNT_CAP,
				};
			}),
		);
		if (counts.every((c) => c.count === 0)) return null;
		return { contract: CONTRACT, lastActiveAt: null, counts };
	},
});

async function countOwned(ctx: QueryCtx, table: TableNames, userId: string) {
	const owned = USER_DATA[table] as Owned<TableNames>;
	const rows = await loose(ctx, table)
		.withIndex(owned.index, (q) => q.eq(owned.field, userId))
		.take(COUNT_CAP + 1);
	return rows.length;
}

/**
 * Nothing stops Fairway's data from being deleted: `account.deleteMyData`
 * refuses no one, and an active round is the caller's own. Always null until
 * a real blocker exists.
 */
export const deletionBlocker = query({
	args: {},
	handler: async (
		_ctx,
	): Promise<{ code: string; params: Record<string, unknown> } | null> => null,
});

export interface PortalExportPage {
	contract: typeof CONTRACT;
	app: typeof APP;
	tables: Record<string, unknown[]>;
	next: string | null;
}

/**
 * One page of the caller's export, in the in-app export's content (auth
 * subjects left out; catalog courses and tees the rows name, by name, under
 * `catalogCourses` and `catalogTees`). `cursor` is null for the first page,
 * then each `next` until it is null. It encodes an `account.exportPage` step
 * as JSON; the portal never parses it. Tables without rows on a page are left
 * out, and tables the caller has no rows in are skipped.
 */
export const exportPage = query({
	args: { cursor: v.union(v.string(), v.null()) },
	handler: async (ctx, { cursor }): Promise<PortalExportPage> => {
		const userId = await getOptionalUserId(ctx);
		if (!userId)
			return { contract: CONTRACT, app: APP, tables: {}, next: null };
		const step = await skipEmptyTables(
			ctx,
			userId,
			cursor === null
				? { table: OWNED_TABLES[0], cursor: null }
				: decodeCursor(cursor),
		);
		if (!step) return { contract: CONTRACT, app: APP, tables: {}, next: null };
		const page = await exportStep(ctx, userId, step);
		const tables: Record<string, unknown[]> = {};
		const add = (name: string, rows: readonly unknown[]) => {
			if (rows.length > 0) tables[name] = [...rows];
		};
		for (const [name, rows] of Object.entries(page.tables)) add(name, rows);
		add("catalogCourses", page.catalog.courses);
		add("catalogTees", page.catalog.tees);
		return {
			contract: CONTRACT,
			app: APP,
			tables,
			next: page.next ? JSON.stringify(page.next) : null,
		};
	},
});

/**
 * From a table's start, the first owned table that holds a row of the
 * caller's, or null when none is left. One indexed `take(1)` per table: a
 * query may paginate only once, so the page itself is the single `paginate`.
 */
async function skipEmptyTables(
	ctx: QueryCtx,
	userId: string,
	step: ExportStep,
): Promise<ExportStep | null> {
	if (step.cursor !== null) return step;
	for (let at = OWNED_TABLES.indexOf(step.table as TableNames); ; at++) {
		const table = OWNED_TABLES[at];
		if (!table) return null;
		const owned = USER_DATA[table] as Owned<TableNames>;
		const [row] = await loose(ctx, table)
			.withIndex(owned.index, (q) => q.eq(owned.field, userId))
			.take(1);
		if (row) return { table, cursor: null };
	}
}

/** A cursor this module wrote: an export step, or a stable refusal. */
function decodeCursor(cursor: string): ExportStep {
	let parsed: unknown;
	try {
		parsed = JSON.parse(cursor);
	} catch {
		throw new ConvexError({ code: "invalidCursor" });
	}
	if (
		typeof parsed === "object" &&
		parsed !== null &&
		"table" in parsed &&
		"cursor" in parsed &&
		typeof parsed.table === "string" &&
		(OWNED_TABLES as readonly string[]).includes(parsed.table) &&
		(parsed.cursor === null || typeof parsed.cursor === "string")
	) {
		return { table: parsed.table, cursor: parsed.cursor };
	}
	throw new ConvexError({ code: "invalidCursor" });
}
