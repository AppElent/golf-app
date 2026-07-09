import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
