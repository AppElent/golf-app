import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./lib";

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const clubs = await ctx.db
			.query("clubs")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		return clubs.sort((a, b) => a.sortOrder - b.sortOrder);
	},
});

/** Add a club to the end of the bag. */
export const create = mutation({
	args: { name: v.string(), carryMeters: v.number() },
	handler: async (ctx, { name, carryMeters }) => {
		const userId = await getUserId(ctx);
		const existing = await ctx.db
			.query("clubs")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		const sortOrder =
			existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
		return await ctx.db.insert("clubs", {
			userId,
			name,
			carryMeters,
			sortOrder,
		});
	},
});

/** Edit a club's name and/or carry distance. */
export const update = mutation({
	args: {
		clubId: v.id("clubs"),
		name: v.optional(v.string()),
		carryMeters: v.optional(v.number()),
	},
	handler: async (ctx, { clubId, name, carryMeters }) => {
		const userId = await getUserId(ctx);
		const club = await ctx.db.get(clubId);
		if (!club || club.userId !== userId) throw new Error("Club not found.");
		const patch: { name?: string; carryMeters?: number } = {};
		if (name !== undefined) patch.name = name;
		if (carryMeters !== undefined) patch.carryMeters = carryMeters;
		await ctx.db.patch(clubId, patch);
	},
});

/** Delete a club. */
export const remove = mutation({
	args: { clubId: v.id("clubs") },
	handler: async (ctx, { clubId }) => {
		const userId = await getUserId(ctx);
		const club = await ctx.db.get(clubId);
		if (!club || club.userId !== userId) throw new Error("Club not found.");
		await ctx.db.delete(clubId);
	},
});

/** Rewrite sort order from a full ordered id list (owner's clubs only). */
export const reorder = mutation({
	args: { orderedIds: v.array(v.id("clubs")) },
	handler: async (ctx, { orderedIds }) => {
		const userId = await getUserId(ctx);
		await Promise.all(
			orderedIds.map(async (id, i) => {
				const club = await ctx.db.get(id);
				if (!club || club.userId !== userId) throw new Error("Club not found.");
				await ctx.db.patch(id, { sortOrder: i });
			}),
		);
	},
});
