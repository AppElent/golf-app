import { v } from "convex/values";
import {
	adjustedGrossScore,
	playingHandicap,
	scoreDifferential,
} from "../src/domain/handicap";
import { stablefordPoints, totalStrokes } from "../src/domain/scoring";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./lib";

const playerInput = v.object({
	name: v.string(),
	handicapIndex: v.optional(v.number()),
});

/**
 * Start a round. Validates every selected hole has par + stroke index
 * (scoring math needs them) and computes each player's playing handicap
 * server-side from the tee's CR/slope and the selected holes' par total.
 */
export const start = mutation({
	args: {
		courseId: v.id("courses"),
		teeId: v.id("tees"),
		holeRefs: v.array(v.string()),
		loopLabel: v.optional(v.string()),
		format: v.union(v.literal("stroke"), v.literal("stableford")),
		players: v.array(playerInput),
	},
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);

		const existing = await ctx.db
			.query("rounds")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.first();
		if (existing) {
			throw new Error(
				"An active round already exists — finish or abandon it first.",
			);
		}
		if (args.players.length === 0) {
			throw new Error("A round needs at least one player.");
		}
		if (args.holeRefs.length === 0) {
			throw new Error("A round needs at least one hole.");
		}

		const tee = await ctx.db.get(args.teeId);
		if (!tee || tee.courseId !== args.courseId) {
			throw new Error("Tee does not belong to this course.");
		}

		const courseHoles = await ctx.db
			.query("holes")
			.withIndex("by_course", (q) => q.eq("courseId", args.courseId))
			.collect();
		const byRef = new Map(courseHoles.map((h) => [h.ref, h]));

		const incomplete: string[] = [];
		let parTotal = 0;
		for (const ref of args.holeRefs) {
			const hole = byRef.get(ref);
			if (!hole || hole.par === undefined || hole.strokeIndex === undefined) {
				incomplete.push(ref);
			} else {
				parTotal += hole.par;
			}
		}
		if (incomplete.length > 0) {
			throw new Error(
				`Holes missing par/stroke index: ${incomplete.join(", ")}. Complete them in the course editor first.`,
			);
		}

		const players = args.players.map((p) => ({
			name: p.name,
			handicapIndex: p.handicapIndex,
			playingHandicap:
				p.handicapIndex === undefined
					? undefined
					: playingHandicap(
							p.handicapIndex,
							tee.slopeRating,
							tee.courseRating,
							parTotal,
						),
		}));

		return await ctx.db.insert("rounds", {
			userId,
			courseId: args.courseId,
			teeId: args.teeId,
			holeRefs: args.holeRefs,
			loopLabel: args.loopLabel,
			startedAt: Date.now(),
			format: args.format,
			status: "active",
			players,
			currentHoleIndex: 0,
		});
	},
});

/** The user's active round, assembled for the scorecard/play screens. */
export const active = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const round = await ctx.db
			.query("rounds")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.first();
		if (!round) return null;

		const [course, tee, courseHoles, scores] = await Promise.all([
			ctx.db.get(round.courseId),
			ctx.db.get(round.teeId),
			ctx.db
				.query("holes")
				.withIndex("by_course", (q) => q.eq("courseId", round.courseId))
				.collect(),
			ctx.db
				.query("holeScores")
				.withIndex("by_round", (q) => q.eq("roundId", round._id))
				.collect(),
		]);
		if (!course || !tee) return null;

		const byRef = new Map(courseHoles.map((h) => [h.ref, h]));
		const holes = round.holeRefs.map((ref) => {
			const hole = byRef.get(ref);
			return {
				ref,
				// start() guarantees these exist for every round hole
				par: hole?.par ?? 0,
				strokeIndex: hole?.strokeIndex ?? 0,
				lengthMeters: hole?.lengthMeters,
			};
		});

		return { round, course, tee, holes, scores };
	},
});

/** Guard: the round exists, belongs to the caller, and is active. */
async function requireActiveRound(ctx: MutationCtx, roundId: Id<"rounds">) {
	const userId = await getUserId(ctx);
	const round = await ctx.db.get(roundId);
	if (!round || round.userId !== userId) throw new Error("Round not found.");
	if (round.status !== "active") throw new Error("Round is not active.");
	return round;
}

/** Upsert one player's result on one hole. Last write wins (single scorer). */
export const setScore = mutation({
	args: {
		roundId: v.id("rounds"),
		holeIndex: v.number(),
		playerIndex: v.number(),
		strokes: v.optional(v.number()),
		putts: v.optional(v.number()),
		fir: v.optional(v.boolean()),
		gir: v.optional(v.boolean()),
		penalties: v.optional(v.number()),
		nr: v.optional(v.boolean()),
	},
	handler: async (ctx, { roundId, holeIndex, playerIndex, ...fields }) => {
		const round = await requireActiveRound(ctx, roundId);
		if (holeIndex < 0 || holeIndex >= round.holeRefs.length) {
			throw new Error("holeIndex out of range.");
		}
		if (playerIndex < 0 || playerIndex >= round.players.length) {
			throw new Error("playerIndex out of range.");
		}
		const existing = await ctx.db
			.query("holeScores")
			.withIndex("by_round_hole_player", (q) =>
				q
					.eq("roundId", roundId)
					.eq("holeIndex", holeIndex)
					.eq("playerIndex", playerIndex),
			)
			.first();
		if (existing) {
			await ctx.db.patch(existing._id, fields);
		} else {
			await ctx.db.insert("holeScores", {
				roundId,
				holeIndex,
				playerIndex,
				...fields,
			});
		}
	},
});

export const setCurrentHole = mutation({
	args: { roundId: v.id("rounds"), holeIndex: v.number() },
	handler: async (ctx, { roundId, holeIndex }) => {
		const round = await requireActiveRound(ctx, roundId);
		if (holeIndex < 0 || holeIndex >= round.holeRefs.length) {
			throw new Error("holeIndex out of range.");
		}
		await ctx.db.patch(roundId, { currentHoleIndex: holeIndex });
	},
});

/** Delete the active round and its scores. */
export const abandon = mutation({
	args: { roundId: v.id("rounds") },
	handler: async (ctx, { roundId }) => {
		await requireActiveRound(ctx, roundId);
		const scores = await ctx.db
			.query("holeScores")
			.withIndex("by_round", (q) => q.eq("roundId", roundId))
			.collect();
		await Promise.all(scores.map((s) => ctx.db.delete(s._id)));
		await ctx.db.delete(roundId);
	},
});

/**
 * Finish the round: stamp per-player totals (strokes + Stableford points) and
 * the owner's WHS score differential — only for complete 18-hole rounds with
 * no NR (spec §8); otherwise null.
 */
export const finish = mutation({
	args: { roundId: v.id("rounds") },
	handler: async (ctx, { roundId }) => {
		const round = await requireActiveRound(ctx, roundId);
		const [tee, courseHoles, scores] = await Promise.all([
			ctx.db.get(round.teeId),
			ctx.db
				.query("holes")
				.withIndex("by_course", (q) => q.eq("courseId", round.courseId))
				.collect(),
			ctx.db
				.query("holeScores")
				.withIndex("by_round", (q) => q.eq("roundId", round._id))
				.collect(),
		]);
		if (!tee) throw new Error("Tee not found.");

		const byRef = new Map(courseHoles.map((h) => [h.ref, h]));
		const holes = round.holeRefs.map((ref) => {
			const hole = byRef.get(ref);
			return { par: hole?.par ?? 0, strokeIndex: hole?.strokeIndex ?? 0 };
		});

		const scoreOf = (holeIndex: number, playerIndex: number) =>
			scores.find(
				(s) => s.holeIndex === holeIndex && s.playerIndex === playerIndex,
			);

		const totals = round.players.map((player, playerIndex) => {
			const strokes = holes.map((_, holeIndex) => {
				const s = scoreOf(holeIndex, playerIndex);
				return s?.nr ? null : (s?.strokes ?? null);
			});
			const points = strokes.reduce<number>(
				(sum, s, i) =>
					sum + stablefordPoints(holes[i], s, player.playingHandicap ?? 0),
				0,
			);
			return { strokes: totalStrokes(strokes), points };
		});

		// Owner differential: 18 holes, no NR, every stroke entered.
		const owner = round.players[0];
		const ownerStrokes = holes.map((_, i) => scoreOf(i, 0));
		const complete =
			round.holeRefs.length === 18 &&
			ownerStrokes.every((s) => s?.strokes !== undefined && !s.nr);
		const differential =
			complete && owner.playingHandicap !== undefined
				? scoreDifferential(
						adjustedGrossScore(
							holes,
							ownerStrokes.map((s) => s?.strokes ?? 0),
							owner.playingHandicap,
						),
						tee.courseRating,
						tee.slopeRating,
					)
				: null;

		await ctx.db.patch(roundId, {
			status: "finished",
			totals,
			scoreDifferential: differential,
		});
		return { totals, scoreDifferential: differential };
	},
});
