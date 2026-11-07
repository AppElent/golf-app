import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./lib";
import {
	assertHoleOfRound,
	requireActiveRound,
	requireOwnRound,
} from "./rounds";
import { latLng } from "./validators";

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
		const round = await requireActiveRound(ctx, roundId);
		assertHoleOfRound(round, holeIndex);
		return await ctx.db.insert("shots", {
			userId: round.userId,
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
