import type { DataModel, Doc, Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * What every table holds for one user: the registry data export and account
 * deletion walk (convex standard, "Account deletion and export"). Typed by every table in
 * the schema, so a new table fails typecheck until it states its treatment,
 * and `functions.test.ts` fails until the export returns its rows.
 */

type IndexOf<T extends TableNames> = keyof DataModel[T]["indexes"] & string;

/** The first field of index `I`: the value the export reads it by. */
type LeadField<
	T extends TableNames,
	I extends IndexOf<T>,
> = DataModel[T]["indexes"][I] extends readonly [infer F, ...unknown[]]
	? F
	: never;

/** Catalog rows a user's row names, exported by name so the file reads on its own. */
export interface CatalogIds {
	courses?: readonly (Id<"courses"> | undefined)[];
	tees?: readonly (Id<"tees"> | undefined)[];
}

/** Rows the user owns: read by an index on their user id, `pageSize` per page. */
export type Owned<T extends TableNames> = {
	[I in IndexOf<T>]: {
		kind: "owned";
		index: I;
		/** Holds the caller's auth subject; left out of the file. */
		field: LeadField<T, I>;
		pageSize: number;
		references?: (doc: Doc<T>) => CatalogIds;
	};
}[IndexOf<T>];

/** Rows of an owned row: read by an index on the parent's id, page by page with the parent. */
export type Child<T extends TableNames> = {
	[I in IndexOf<T>]: {
		kind: "child";
		parent: TableNames;
		index: I;
		field: LeadField<T, I>;
	};
}[IndexOf<T>];

export type Treatment<T extends TableNames> =
	| Owned<T>
	| Child<T>
	| { kind: "shared"; reason: string };

export const USER_DATA: { [T in TableNames]: Treatment<T> } = {
	userSettings: {
		kind: "owned",
		index: "by_user",
		field: "userId",
		pageSize: 100,
		references: (s) => ({ courses: [s.homeCourseId] }),
	},
	clubs: { kind: "owned", index: "by_user", field: "userId", pageSize: 200 },
	// 20 rounds of up to 36 holes for 4 players stay far below the read limits.
	rounds: {
		kind: "owned",
		index: "by_user",
		field: "userId",
		pageSize: 20,
		references: (r) => ({ courses: [r.courseId], tees: [r.teeId] }),
	},
	holeScores: {
		kind: "child",
		parent: "rounds",
		index: "by_round",
		field: "roundId",
	},
	shots: { kind: "owned", index: "by_user", field: "userId", pageSize: 500 },
	courseSuggestions: {
		kind: "owned",
		index: "by_user",
		field: "userId",
		pageSize: 200,
		references: (s) => ({ courses: [s.courseId] }),
	},
	// The user's own course copies. Catalog courses have no ownerId, so this
	// index never returns them. One copy per page: with all its hole geometry
	// a course is about 300 kB.
	courses: {
		kind: "owned",
		index: "by_owner",
		field: "ownerId",
		pageSize: 1,
		references: (c) => ({ courses: [c.forkedFrom] }),
	},
	tees: {
		kind: "child",
		parent: "courses",
		index: "by_course",
		field: "courseId",
	},
	holes: {
		kind: "child",
		parent: "courses",
		index: "by_course",
		field: "courseId",
	},
	holeGeometry: {
		kind: "child",
		parent: "courses",
		index: "by_course",
		field: "courseId",
	},
};

/** Tables read by the user's id, in export order. */
export const OWNED_TABLES = (Object.keys(USER_DATA) as TableNames[]).filter(
	(table) => USER_DATA[table].kind === "owned",
);

/** The tables read under `parent`, page by page with it. */
export function childTables(parent: TableNames): TableNames[] {
	return (Object.keys(USER_DATA) as TableNames[]).filter((table) => {
		const treatment = USER_DATA[table];
		return treatment.kind === "child" && treatment.parent === parent;
	});
}

/**
 * `ctx.db.query` for a table chosen at runtime. The registry's types already
 * tie each index to its table and lead field; TypeScript cannot follow that
 * through a union of tables, so this view drops it.
 */
export function loose(ctx: QueryCtx, table: TableNames) {
	type Eq = { eq(field: string, value: unknown): Eq };
	type Query = {
		withIndex(
			index: string,
			range: (q: Eq) => Eq,
		): {
			collect(): Promise<Doc<TableNames>[]>;
			take(n: number): Promise<Doc<TableNames>[]>;
			paginate(opts: { cursor: string | null; numItems: number }): Promise<{
				page: Doc<TableNames>[];
				isDone: boolean;
				continueCursor: string;
			}>;
		};
	};
	return ctx.db.query(table) as unknown as Query;
}

/** Rows one purge batch deletes at most: far below a mutation's write limits,
 *  and a course copy's geometry (about 300 kB) fits several times over. */
export const PURGE_BATCH = 1000;

/**
 * Delete up to `PURGE_BATCH` of one user's rows, walking `USER_DATA`: each
 * owned row after the rows under it, tables in registry order. `done` once
 * nothing of theirs is left. The only purge: "Delete Fairway data only",
 * whole-account deletion and the Clerk `user.deleted` webhook all run it.
 * Shared rows (catalog courses) are never read by an owner index, so they stay.
 */
export async function purgeUserData(
	ctx: MutationCtx,
	userId: string,
	budget = PURGE_BATCH,
): Promise<{ done: boolean }> {
	let left = budget;
	for (const table of OWNED_TABLES) {
		const owned = USER_DATA[table] as Owned<TableNames>;
		const children = childTables(table).map((child) => ({
			table: child,
			treatment: USER_DATA[child] as Child<TableNames>,
		}));
		for (;;) {
			const rows = await loose(ctx, table)
				.withIndex(owned.index, (q) => q.eq(owned.field, userId))
				.take(Math.min(left, 100));
			if (rows.length === 0) break;
			for (const row of rows) {
				for (const child of children) {
					const under = await loose(ctx, child.table)
						.withIndex(child.treatment.index, (q) =>
							q.eq(child.treatment.field, row._id),
						)
						.take(left);
					for (const doc of under) await ctx.db.delete(doc._id);
					left -= under.length;
					// Out of budget: the parent waits for the next batch, so no
					// row under it is ever left without one.
					if (left === 0) return { done: false };
				}
				await ctx.db.delete(row._id);
				left -= 1;
				if (left === 0) return { done: false };
			}
		}
	}
	return { done: true };
}
