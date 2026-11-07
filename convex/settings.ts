import { DEFAULT_UNITS, type Units } from "@fairway/core/format";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { canSee } from "./courses";
import { getUserId } from "./lib";
import { unitPreference } from "./validators";

/** Patch the user's settings row, creating it when missing. */
export async function upsertSettings(
	ctx: MutationCtx,
	userId: string,
	patch: {
		units?: Units;
		homeCourseId?: Id<"courses">;
		handicapIndex?: number;
	},
) {
	const existing = await ctx.db
		.query("userSettings")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.first();
	if (existing) {
		await ctx.db.patch(existing._id, patch);
		return existing._id;
	}
	return await ctx.db.insert("userSettings", {
		units: DEFAULT_UNITS,
		...patch,
		userId,
	});
}

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
			units: row?.units ?? DEFAULT_UNITS,
			homeCourseId: row?.homeCourseId ?? null,
			handicapIndex: row?.handicapIndex ?? null,
		};
	},
});

export const update = mutation({
	args: {
		units: v.optional(unitPreference),
		homeCourseId: v.optional(v.union(v.id("courses"), v.null())),
		handicapIndex: v.optional(v.union(v.number(), v.null())),
	},
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		if (args.homeCourseId) {
			const course = await ctx.db.get(args.homeCourseId);
			if (!course || !canSee(course, userId)) {
				throw new Error("Course not found.");
			}
		}
		// null clears an optional field; undefined leaves it unchanged.
		const { units, homeCourseId, handicapIndex } = args;
		return await upsertSettings(ctx, userId, {
			...(units !== undefined && { units }),
			...(homeCourseId !== undefined && {
				homeCourseId: homeCourseId ?? undefined,
			}),
			...(handicapIndex !== undefined && {
				handicapIndex: handicapIndex ?? undefined,
			}),
		});
	},
});
