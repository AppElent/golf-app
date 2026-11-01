import { type LatLng, polygonCentroid } from "@fairway/core/geo";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { CATALOG, type CatalogCourse, geometryFor } from "./catalog";

/**
 * Write the committed course catalog (convex/catalog) into the database.
 * Idempotent and safe on every deploy: rows are matched by stable keys
 * (course `catalogKey`, tee name, hole/geometry ref) and patched in place, so
 * ids that rounds point at survive. The catalog always wins over database
 * edits. Holes and geometry the catalog dropped are deleted (rounds keep refs,
 * not ids); a dropped tee is deleted, or retired when a round still uses it.
 *
 * `pnpm exec convex run courseCatalog:sync` (add `--prod` for production).
 * PR previews run it through `seedPreview:seedPreview`.
 */
export const sync = internalMutation({
	args: {},
	handler: async (ctx) => {
		const results: {
			key: string;
			courseId: Id<"courses">;
			created: boolean;
		}[] = [];
		const adopted = new Set<number>();
		for (const entry of CATALOG) {
			const { courseId, created } = await upsertCourse(ctx, entry, adopted);
			await syncTees(ctx, courseId, entry);
			await syncHoles(ctx, courseId, entry);
			await syncGeometry(ctx, courseId, entry);
			results.push({ key: entry.key, courseId, created });
		}
		return results;
	},
});

async function upsertCourse(
	ctx: MutationCtx,
	entry: CatalogCourse,
	adopted: Set<number>,
): Promise<{ courseId: Id<"courses">; created: boolean }> {
	const fields = {
		name: entry.name,
		city: entry.city,
		osmRelationId: entry.osmRelationId,
		catalogKey: entry.key,
		location: courseLocation(geometryFor(entry)) ?? undefined,
		importStatus: "imported" as const,
	};
	let existing = await ctx.db
		.query("courses")
		.withIndex("by_catalog_key", (q) => q.eq("catalogKey", entry.key))
		.unique();
	// A course imported before the catalog existed becomes the first catalog
	// course on its OSM relation, so its rounds stay attached.
	if (!existing && !adopted.has(entry.osmRelationId)) {
		const legacy = await ctx.db
			.query("courses")
			.withIndex("by_catalog_key", (q) => q.eq("catalogKey", undefined))
			.filter((q) =>
				q.and(
					q.eq(q.field("osmRelationId"), entry.osmRelationId),
					q.eq(q.field("ownerId"), undefined),
				),
			)
			.first();
		existing = legacy;
	}
	adopted.add(entry.osmRelationId);
	if (existing) {
		await ctx.db.patch(existing._id, fields);
		return { courseId: existing._id, created: false };
	}
	return { courseId: await ctx.db.insert("courses", fields), created: true };
}

async function syncTees(
	ctx: MutationCtx,
	courseId: Id<"courses">,
	entry: CatalogCourse,
) {
	const current = await ctx.db
		.query("tees")
		.withIndex("by_course", (q) => q.eq("courseId", courseId))
		.collect();
	for (const tee of entry.tees) {
		const match = current.find((t) => t.name === tee.name);
		const fields = { courseId, ...tee, retired: undefined };
		if (match) await ctx.db.patch(match._id, fields);
		else await ctx.db.insert("tees", fields);
	}
	const wanted = new Set(entry.tees.map((t) => t.name));
	for (const tee of current) {
		if (wanted.has(tee.name)) continue;
		await retireOrDeleteTee(ctx, tee);
	}
}

async function retireOrDeleteTee(ctx: MutationCtx, tee: Doc<"tees">) {
	const used = await ctx.db
		.query("rounds")
		.withIndex("by_tee", (q) => q.eq("teeId", tee._id))
		.first();
	if (used) await ctx.db.patch(tee._id, { retired: true });
	else await ctx.db.delete(tee._id);
}

async function syncHoles(
	ctx: MutationCtx,
	courseId: Id<"courses">,
	entry: CatalogCourse,
) {
	const current = await ctx.db
		.query("holes")
		.withIndex("by_course", (q) => q.eq("courseId", courseId))
		.collect();
	for (const hole of entry.holes) {
		const match = current.find((h) => h.ref === hole.ref);
		if (match) await ctx.db.patch(match._id, hole);
		else await ctx.db.insert("holes", { courseId, ...hole });
	}
	const wanted = new Set(entry.holes.map((h) => h.ref));
	for (const hole of current) {
		if (hole.ref === undefined || !wanted.has(hole.ref)) {
			await ctx.db.delete(hole._id);
		}
	}
}

async function syncGeometry(
	ctx: MutationCtx,
	courseId: Id<"courses">,
	entry: CatalogCourse,
) {
	const current = await ctx.db
		.query("holeGeometry")
		.withIndex("by_course", (q) => q.eq("courseId", courseId))
		.collect();
	const geometry = geometryFor(entry);
	for (const g of geometry) {
		const match = current.find((x) => x.ref === g.ref);
		if (match) await ctx.db.replace(match._id, { courseId, ...g });
		else await ctx.db.insert("holeGeometry", { courseId, ...g });
	}
	const wanted = new Set(geometry.map((g) => g.ref));
	for (const g of current) {
		if (!wanted.has(g.ref)) await ctx.db.delete(g._id);
	}
}

/** The course's "where": the centroid of its greens (for nearby sorting). */
export function courseLocation(
	geometry: ReadonlyArray<{ greens: ReadonlyArray<ReadonlyArray<LatLng>> }>,
): LatLng | null {
	const greens = geometry.flatMap((g) =>
		g.greens.filter((p) => p.length > 0).map(polygonCentroid),
	);
	return greens.length > 0 ? polygonCentroid(greens) : null;
}
