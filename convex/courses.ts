import { v } from "convex/values";
import { normalizeCourse } from "../src/domain/osm";
import { internal } from "./_generated/api";
import {
	action,
	internalMutation,
	mutation,
	query,
} from "./_generated/server";

/** All courses, name-sorted, for the picker/list. */
export const list = query({
	args: {},
	handler: async (ctx) => {
		const courses = await ctx.db.query("courses").collect();
		return courses.sort((a, b) => a.name.localeCompare(b.name));
	},
});

/** One course with its tees, holes (number-sorted), and geometry. */
export const get = query({
	args: { courseId: v.id("courses") },
	handler: async (ctx, { courseId }) => {
		const course = await ctx.db.get(courseId);
		if (!course) return null;
		const [tees, holes, geometry] = await Promise.all([
			ctx.db
				.query("tees")
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect(),
			ctx.db
				.query("holes")
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect(),
			ctx.db
				.query("holeGeometry")
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect(),
		]);
		return {
			course,
			tees,
			holes: holes.sort((a, b) => a.number - b.number),
			geometry,
		};
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		city: v.optional(v.string()),
		osmRelationId: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("courses", {
			name: args.name,
			city: args.city,
			osmRelationId: args.osmRelationId,
			importStatus: "manual",
		});
	},
});

export const updateMeta = mutation({
	args: {
		courseId: v.id("courses"),
		name: v.optional(v.string()),
		city: v.optional(v.string()),
	},
	handler: async (ctx, { courseId, name, city }) => {
		const patch: { name?: string; city?: string } = {};
		if (name !== undefined) patch.name = name;
		if (city !== undefined) patch.city = city;
		await ctx.db.patch(courseId, patch);
	},
});

export const upsertTee = mutation({
	args: {
		teeId: v.optional(v.id("tees")),
		courseId: v.id("courses"),
		name: v.string(),
		color: v.optional(v.string()),
		courseRating: v.number(),
		slopeRating: v.number(),
	},
	handler: async (ctx, { teeId, ...fields }) => {
		if (teeId) {
			await ctx.db.patch(teeId, fields);
			return teeId;
		}
		return await ctx.db.insert("tees", fields);
	},
});

/** Set par + stroke index for a hole (editor's main job for OSM gaps). */
export const upsertHole = mutation({
	args: {
		holeId: v.id("holes"),
		par: v.optional(v.number()),
		strokeIndex: v.optional(v.number()),
	},
	handler: async (ctx, { holeId, par, strokeIndex }) => {
		await ctx.db.patch(holeId, { par, strokeIndex });
	},
});

const latLng = v.object({ lat: v.number(), lng: v.number() });
const polygon = v.array(latLng);

/**
 * Replace a course's holes + geometry from a normalized import. Wipes existing
 * holes/geometry first so re-imports are idempotent. Internal — only the import
 * action calls it.
 */
export const storeImport = internalMutation({
	args: {
		courseId: v.id("courses"),
		holes: v.array(
			v.object({
				number: v.number(),
				ref: v.string(),
				par: v.union(v.number(), v.null()),
				strokeIndex: v.union(v.number(), v.null()),
				lengthMeters: v.number(),
			}),
		),
		geometry: v.array(
			v.object({
				ref: v.string(),
				holeNumber: v.number(),
				holeLine: polygon,
				fairways: v.array(polygon),
				greens: v.array(polygon),
				bunkers: v.array(polygon),
				tees: v.array(polygon),
				water: v.array(polygon),
			}),
		),
	},
	handler: async (ctx, { courseId, holes, geometry }) => {
		const oldHoles = await ctx.db
			.query("holes")
			.withIndex("by_course", (q) => q.eq("courseId", courseId))
			.collect();
		const oldGeometry = await ctx.db
			.query("holeGeometry")
			.withIndex("by_course", (q) => q.eq("courseId", courseId))
			.collect();
		await Promise.all(
			[...oldHoles, ...oldGeometry].map((doc) => ctx.db.delete(doc._id)),
		);

		await Promise.all(
			holes.map((h) =>
				ctx.db.insert("holes", {
					courseId,
					number: h.number,
					ref: h.ref,
					par: h.par ?? undefined,
					strokeIndex: h.strokeIndex ?? undefined,
					lengthMeters: h.lengthMeters,
				}),
			),
		);
		await Promise.all(
			geometry.map((g) => ctx.db.insert("holeGeometry", { courseId, ...g })),
		);

		const complete = holes.every(
			(h) => h.par !== null && h.strokeIndex !== null,
		);
		await ctx.db.patch(courseId, {
			importStatus: complete ? "imported" : "partial",
		});
	},
});

/** Fetch a course's geometry from Overpass and store it. Re-runnable. */
export const importFromOsm = action({
	args: { courseId: v.id("courses"), osmRelationId: v.number() },
	handler: async (ctx, { courseId, osmRelationId }) => {
		const q = `[out:json][timeout:90];rel(${osmRelationId});map_to_area->.a;(way(area.a)[golf];);out geom tags;`;
		const res = await fetch("https://overpass-api.de/api/interpreter", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": "golf-app/0.1",
			},
			body: `data=${encodeURIComponent(q)}`,
		});
		if (!res.ok) {
			throw new Error(`Overpass request failed: HTTP ${res.status}`);
		}
		const data = (await res.json()) as { elements: unknown[] };
		const normalized = normalizeCourse(
			data.elements as Parameters<typeof normalizeCourse>[0],
		);
		await ctx.runMutation(internal.courses.storeImport, {
			courseId,
			holes: normalized.holes.map((h) => ({
				number: h.number,
				ref: h.ref,
				par: h.par,
				strokeIndex: h.strokeIndex,
				lengthMeters: h.lengthMeters,
			})),
			geometry: normalized.geometry,
		});
		return { holes: normalized.holes.length };
	},
});
