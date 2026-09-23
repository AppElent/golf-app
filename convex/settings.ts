import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./lib";

/** Current user's settings, with defaults when no row exists yet. */
export const get = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const row = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();
		return {
			units: row?.units ?? ("m" as const),
			homeCourseId: row?.homeCourseId ?? null,
			handicapIndex: row?.handicapIndex ?? null,
		};
	},
});

/** Upsert any subset of the user's settings. */
export const update = mutation({
	args: {
		units: v.optional(v.union(v.literal("m"), v.literal("yd"))),
		homeCourseId: v.optional(v.union(v.id("courses"), v.null())),
		handicapIndex: v.optional(v.union(v.number(), v.null())),
	},
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		const existing = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();

		// null clears an optional field; undefined leaves it unchanged.
		const patch: {
			units?: "m" | "yd";
			homeCourseId?: import("./_generated/dataModel").Id<"courses"> | undefined;
			handicapIndex?: number | undefined;
		} = {};
		if (args.units !== undefined) patch.units = args.units;
		if (args.homeCourseId !== undefined)
			patch.homeCourseId = args.homeCourseId ?? undefined;
		if (args.handicapIndex !== undefined)
			patch.handicapIndex = args.handicapIndex ?? undefined;

		if (existing) {
			await ctx.db.patch(existing._id, patch);
			return existing._id;
		}
		return await ctx.db.insert("userSettings", {
			userId,
			units: patch.units ?? "m",
			homeCourseId: patch.homeCourseId,
			handicapIndex: patch.handicapIndex,
		});
	},
});
