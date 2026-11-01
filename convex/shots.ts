import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./lib";

const latLng = v.object({ lat: v.number(), lng: v.number() });

async function requireOwnRound(ctx: QueryCtx, roundId: Id<"rounds">) {
	const userId = await getUserId(ctx);
	const round = await ctx.db.get(roundId);
	if (!round || round.userId !== userId) throw new Error("Round not found.");
	return { userId, round };
}

/** Shots of one round, in marking order. */
export const forRound = query({
	args: { roundId: v.id("rounds") },
	handler: async (ctx, { roundId }) => {
		await requireOwnRound(ctx, roundId);
		const shots = await ctx.db
			.query("shots")
			.withIndex("by_round", (q) => q.eq("roundId", roundId))
			.collect();
		return shots.sort((a, b) => a.markedAt - b.markedAt);
	},
});

/** Every shot the user has marked (input for learned club distances). */
export const mine = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		return await ctx.db
			.query("shots")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
	},
});

/** Mark the ball's position for the next shot on a hole of an active round. */
export const mark = mutation({
	args: {
		roundId: v.id("rounds"),
		holeIndex: v.number(),
		position: latLng,
		club: v.optional(v.string()),
	},
	handler: async (ctx, { roundId, holeIndex, position, club }) => {
		const { userId, round } = await requireOwnRound(ctx, roundId);
		if (round.status !== "active") throw new Error("Round is not active.");
		if (holeIndex < 0 || holeIndex >= round.holeRefs.length) {
			throw new Error("holeIndex out of range.");
		}
		return await ctx.db.insert("shots", {
			userId,
			roundId,
			holeIndex,
			position,
			club,
			markedAt: Date.now(),
		});
	},
});

/** Change the club of a marked shot (any round, own shots only). */
export const setClub = mutation({
	args: { shotId: v.id("shots"), club: v.optional(v.string()) },
	handler: async (ctx, { shotId, club }) => {
		const userId = await getUserId(ctx);
		const shot = await ctx.db.get(shotId);
		if (!shot || shot.userId !== userId) throw new Error("Shot not found.");
		await ctx.db.patch(shotId, { club });
	},
});

export const remove = mutation({
	args: { shotId: v.id("shots") },
	handler: async (ctx, { shotId }) => {
		const userId = await getUserId(ctx);
		const shot = await ctx.db.get(shotId);
		if (!shot || shot.userId !== userId) throw new Error("Shot not found.");
		await ctx.db.delete(shotId);
	},
});
