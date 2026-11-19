import type { ExportPage } from "@fairway/core/data-export";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import {
	internalMutation,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { getUserId } from "./lib";
import {
	type CatalogIds,
	childTables,
	loose,
	OWNED_TABLES,
	type Owned,
	purgeUserData,
	USER_DATA,
} from "./userData";

/**
 * Who Convex says is signed in: the Clerk user id from the verified token, or
 * null. The phone compares it with the account Clerk selected locally before
 * it shows or saves any cached copy (convex-query-caching standard).
 */
export const viewer = query({
	args: {},
	handler: async (ctx) => (await ctx.auth.getUserIdentity())?.subject ?? null,
});

/**
 * Delete what this app stores for the signed-in user (rounds, scores, shots,
 * clubs, settings, course copies, course suggestions), one bounded batch per
 * call; the client repeats it until it returns `done`. The Clerk login is not
 * touched: "Delete Fairway data only" stops here, "Delete my whole AppElent
 * account" deletes the Clerk user afterwards, and the Clerk `user.deleted`
 * webhook (`http.ts`) runs the same purge. Catalog courses are shared and stay.
 *
 * `expectedSubject` is the Clerk user the client means to delete; a different
 * signed-in subject (an account switch mid-run) is refused. Installed apps
 * from before it call with no arguments and expect everything gone in one
 * call, so that call runs every batch in one transaction, as it always did.
 */
export const deleteMyData = mutation({
	args: { expectedSubject: v.optional(v.string()) },
	handler: async (ctx, { expectedSubject }): Promise<{ done: boolean }> => {
		const userId = await getUserId(ctx);
		if (expectedSubject === undefined) {
			while (!(await purgeUserData(ctx, userId)).done) {}
			return { done: true };
		}
		if (expectedSubject !== userId) {
			throw new ConvexError({ code: "accountChanged" });
		}
		return await purgeUserData(ctx, userId);
	},
});

/**
 * The Clerk `user.deleted` webhook's purge: the same batches as
 * `deleteMyData`, for a Clerk user id instead of the session, rescheduling
 * itself until nothing is left. A user with no data here is a no-op.
 */
export const purgeDeletedUser = internalMutation({
	args: { subject: v.string() },
	handler: async (ctx, { subject }) => {
		const { done } = await purgeUserData(ctx, subject);
		if (!done) {
			await ctx.scheduler.runAfter(0, internal.account.purgeDeletedUser, {
				subject,
			});
		}
	},
});

/**
 * One page of "Export my data": the signed-in user's rows of one owned table
 * (`userData.ts`), with the rows under them (a round's scores, a course copy's
 * holes) and the catalog courses and tees they name. The client calls it with
 * no step, then with each `next` until it is null; `collectExport` in
 * `@fairway/core/data-export` does that and builds the file. Pages stay small,
 * so a heavy account never hits a query's read limits. The auth subject
 * (`userId`, `ownerId`) is left out; everything else the user stored is in.
 */
export const exportPage = query({
	args: {
		step: v.optional(
			v.object({ table: v.string(), cursor: v.union(v.string(), v.null()) }),
		),
	},
	handler: async (ctx, { step }): Promise<ExportPage> => {
		const userId = await getUserId(ctx);
		const table = step?.table ?? OWNED_TABLES[0];
		const at = OWNED_TABLES.indexOf(table as TableNames);
		if (at === -1) throw new Error("Unknown export table.");
		const owned = USER_DATA[OWNED_TABLES[at]] as Owned<TableNames>;
		const page = await loose(ctx, OWNED_TABLES[at])
			.withIndex(owned.index, (q) => q.eq(owned.field, userId))
			.paginate({ cursor: step?.cursor ?? null, numItems: owned.pageSize });

		const tables: Record<string, unknown[]> = {
			[table]: page.page.map((doc) => omit(doc, owned.field)),
		};
		for (const child of childTables(OWNED_TABLES[at])) {
			const treatment = USER_DATA[child];
			if (treatment.kind !== "child") continue;
			const rows = await Promise.all(
				page.page.map((parent) =>
					loose(ctx, child)
						.withIndex(treatment.index, (q) =>
							q.eq(treatment.field, parent._id),
						)
						.collect(),
				),
			);
			tables[child] = rows.flat();
		}

		const refs = page.page.map((doc) => owned.references?.(doc) ?? {});
		const next = page.isDone
			? OWNED_TABLES[at + 1]
				? { table: OWNED_TABLES[at + 1], cursor: null }
				: null
			: { table, cursor: page.continueCursor };
		return { tables, catalog: await catalogRows(ctx, refs), next };
	},
});

function omit(doc: Doc<TableNames>, field: string) {
	const { [field]: _subject, ...rest } = doc as Record<string, unknown>;
	return rest;
}

/** Catalog courses and tees only: a user's own copies are in the export
 *  already, and another user's rows never go in it. */
async function catalogRows(ctx: QueryCtx, refs: CatalogIds[]) {
	const courseIds = new Set<Id<"courses">>();
	const teeIds = new Set<Id<"tees">>();
	for (const ref of refs) {
		for (const id of ref.courses ?? []) if (id) courseIds.add(id);
		for (const id of ref.tees ?? []) if (id) teeIds.add(id);
	}
	const tees = (await Promise.all([...teeIds].map((id) => ctx.db.get(id))))
		.filter((t) => t !== null)
		.map((t) => {
			courseIds.add(t.courseId);
			return t;
		});
	const courses = new Map<Id<"courses">, Doc<"courses">>();
	for (const c of await Promise.all(
		[...courseIds].map((id) => ctx.db.get(id)),
	)) {
		if (c && c.ownerId === undefined) courses.set(c._id, c);
	}
	return {
		courses: [...courses.values()].map((c) => ({
			_id: c._id,
			name: c.name,
			city: c.city,
		})),
		tees: tees
			.filter((t) => courses.has(t.courseId))
			.map((t) => ({
				_id: t._id,
				courseId: t.courseId,
				name: t.name,
				color: t.color,
				courseRating: t.courseRating,
				slopeRating: t.slopeRating,
			})),
	};
}
