import { v } from "convex/values";
import { playingHandicap } from "../src/domain/handicap";
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
