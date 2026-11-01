import {
	roundDifferential,
	roundPlayingHandicap,
} from "@fairway/core/handicap";
import { stablefordTotal, totalStrokes, vsPar } from "@fairway/core/scoring";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { canSee } from "./courses";
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

		const course = await ctx.db.get(args.courseId);
		if (!course || !canSee(course, userId)) {
			throw new Error("Course not found.");
		}
		const tee = await ctx.db.get(args.teeId);
		if (!tee || tee.courseId !== args.courseId || tee.retired) {
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
					: roundPlayingHandicap(
							p.handicapIndex,
							tee,
							parTotal,
							args.holeRefs.length,
						),
		}));

		// The index you tee off with is your current one: keep the profile
		// in step so Home and the next setup show it.
		const ownerIndex = args.players[0].handicapIndex;
		if (ownerIndex !== undefined) {
			const settings = await ctx.db
				.query("userSettings")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.unique();
			if (!settings) {
				await ctx.db.insert("userSettings", {
					userId,
					units: "m",
					handicapIndex: ownerIndex,
				});
			} else if (settings.handicapIndex !== ownerIndex) {
				await ctx.db.patch(settings._id, { handicapIndex: ownerIndex });
			}
		}

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

/** Delete a round with its scores and shots. */
export async function deleteRoundData(ctx: MutationCtx, roundId: Id<"rounds">) {
	const [scores, shots] = await Promise.all([
		ctx.db
			.query("holeScores")
			.withIndex("by_round", (q) => q.eq("roundId", roundId))
			.collect(),
		ctx.db
			.query("shots")
			.withIndex("by_round", (q) => q.eq("roundId", roundId))
			.collect(),
	]);
	await Promise.all([...scores, ...shots].map((d) => ctx.db.delete(d._id)));
	await ctx.db.delete(roundId);
}

/**
 * Upsert one player's result on one hole. Last write wins (single scorer).
 * Omitted fields keep their value; `null` clears putts / fairway / green.
 */
export const setScore = mutation({
	args: {
		roundId: v.id("rounds"),
		holeIndex: v.number(),
		playerIndex: v.number(),
		strokes: v.optional(v.number()),
		putts: v.optional(v.union(v.number(), v.null())),
		fir: v.optional(v.union(v.boolean(), v.null())),
		gir: v.optional(v.union(v.boolean(), v.null())),
		penalties: v.optional(v.number()),
		nr: v.optional(v.boolean()),
	},
	handler: async (ctx, { roundId, holeIndex, playerIndex, ...args }) => {
		// Values to store; a null clears the field (patch() drops undefined).
		const set = Object.fromEntries(
			Object.entries(args).filter(([, value]) => value != null),
		);
		const cleared = Object.fromEntries(
			Object.entries(args)
				.filter(([, value]) => value === null)
				.map(([key]) => [key, undefined]),
		);
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
			await ctx.db.patch(existing._id, { ...set, ...cleared });
		} else {
			await ctx.db.insert("holeScores", {
				roundId,
				holeIndex,
				playerIndex,
				...set,
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
		await deleteRoundData(ctx, roundId);
	},
});

/**
 * Finish the round: stamp per-player totals (strokes + Stableford points) and
 * the owner's WHS score differential — only for complete 9- or 18-hole rounds
 * with no NR; otherwise null. 9-hole rounds add the expected differential.
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
			const points = stablefordTotal(
				holes,
				strokes,
				player.playingHandicap ?? 0,
			);
			return { strokes: totalStrokes(strokes), points };
		});

		// Owner differential: 9 or 18 holes, no NR, every stroke entered.
		const owner = round.players[0];
		const differential =
			owner.playingHandicap === undefined
				? null
				: roundDifferential({
						holes,
						strokes: holes.map((_, i) => {
							const s = scoreOf(i, 0);
							return s && !s.nr && s.strokes !== undefined ? s.strokes : null;
						}),
						playingHandicap: owner.playingHandicap,
						handicapIndex: owner.handicapIndex,
						tee,
					});

		await ctx.db.patch(roundId, {
			status: "finished",
			totals,
			scoreDifferential: differential,
		});
		return { totals, scoreDifferential: differential };
	},
});

/**
 * Finished rounds, newest first, with a computed owner (playerIndex 0) summary.
 * `limit` defaults to 20 (spec §5 window). Distances/scoring recomputed from
 * holeScores so rounds finished before this query still get full stats.
 */
export const history = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => {
		const userId = await getUserId(ctx);
		const rounds = await ctx.db
			.query("rounds")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.filter((q) => q.eq(q.field("status"), "finished"))
			.collect();
		rounds.sort((a, b) => b.startedAt - a.startedAt);
		const recent = rounds.slice(0, limit ?? 20);

		const courseNames = new Map<string, string>();

		const summaries = await Promise.all(
			recent.map(async (round) => {
				let courseName = courseNames.get(round.courseId);
				if (courseName === undefined) {
					const course = await ctx.db.get(round.courseId);
					courseName = course?.name ?? "Unknown course";
					courseNames.set(round.courseId, courseName);
				}

				const courseHoles = await ctx.db
					.query("holes")
					.withIndex("by_course", (q) => q.eq("courseId", round.courseId))
					.collect();
				const byRef = new Map(courseHoles.map((h) => [h.ref, h]));
				const holes = round.holeRefs.map((ref) => {
					const hole = byRef.get(ref);
					return {
						par: hole?.par ?? 0,
						strokeIndex: hole?.strokeIndex ?? 0,
						isPar3: (hole?.par ?? 0) === 3,
					};
				});

				const scores = await ctx.db
					.query("holeScores")
					.withIndex("by_round", (q) => q.eq("roundId", round._id))
					.collect();
				const ownerScore = (holeIndex: number) =>
					scores.find((s) => s.holeIndex === holeIndex && s.playerIndex === 0);

				const strokes = holes.map((_, i) => {
					const s = ownerScore(i);
					return s?.nr ? null : (s?.strokes ?? null);
				});

				let putts = 0;
				let holesWithPutts = 0;
				let firMade = 0;
				let firEligible = 0;
				let girMade = 0;
				let girHoles = 0;
				holes.forEach((hole, i) => {
					const s = ownerScore(i);
					if (s?.putts !== undefined) {
						putts += s.putts;
						holesWithPutts += 1;
					}
					if (!hole.isPar3 && s?.fir !== undefined) {
						firEligible += 1;
						if (s.fir) firMade += 1;
					}
					if (s?.gir !== undefined) {
						girHoles += 1;
						if (s.gir) girMade += 1;
					}
				});

				return {
					_id: round._id,
					startedAt: round.startedAt,
					courseName,
					loopLabel: round.loopLabel ?? null,
					format: round.format,
					holeCount: round.holeRefs.length,
					differential: round.scoreDifferential ?? null,
					owner: {
						strokes: totalStrokes(strokes),
						vsPar: vsPar(holes, strokes),
						putts: holesWithPutts > 0 ? putts : null,
						holesWithPutts,
						firMade,
						firEligible,
						girMade,
						girHoles,
					},
				};
			}),
		);

		return summaries;
	},
});

/** One of the user's rounds (any status) with course, tee, holes and scores. */
export const detail = query({
	args: { roundId: v.id("rounds") },
	handler: async (ctx, { roundId }) => {
		const userId = await getUserId(ctx);
		const round = await ctx.db.get(roundId);
		if (!round || round.userId !== userId) return null;
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
				par: hole?.par ?? 0,
				strokeIndex: hole?.strokeIndex ?? 0,
				lengthMeters: hole?.lengthMeters,
			};
		});
		return { round, course, tee, holes, scores };
	},
});

/** Delete one of the user's finished rounds. */
export const remove = mutation({
	args: { roundId: v.id("rounds") },
	handler: async (ctx, { roundId }) => {
		const userId = await getUserId(ctx);
		const round = await ctx.db.get(roundId);
		if (!round || round.userId !== userId) throw new Error("Round not found.");
		await deleteRoundData(ctx, roundId);
	},
});

/**
 * The owner's per-hole results (par + strokes, NR as null) over the latest
 * finished rounds — input for par-type averages and the scoring distribution.
 */
export const holeResults = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => {
		const userId = await getUserId(ctx);
		const rounds = await ctx.db
			.query("rounds")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.filter((q) => q.eq(q.field("status"), "finished"))
			.collect();
		rounds.sort((a, b) => b.startedAt - a.startedAt);
		const parsByCourse = new Map<string, Map<string, number>>();
		const results: Array<{ par: number; strokes: number | null }> = [];
		for (const round of rounds.slice(0, limit ?? 20)) {
			let pars = parsByCourse.get(round.courseId);
			if (pars === undefined) {
				const holes = await ctx.db
					.query("holes")
					.withIndex("by_course", (q) => q.eq("courseId", round.courseId))
					.collect();
				const map = new Map<string, number>();
				for (const h of holes) if (h.ref && h.par) map.set(h.ref, h.par);
				parsByCourse.set(round.courseId, map);
				pars = map;
			}
			const coursePars = pars;
			const scores = await ctx.db
				.query("holeScores")
				.withIndex("by_round", (q) => q.eq("roundId", round._id))
				.collect();
			round.holeRefs.forEach((ref, holeIndex) => {
				const s = scores.find(
					(x) => x.holeIndex === holeIndex && x.playerIndex === 0,
				);
				if (!s) return;
				results.push({
					par: coursePars.get(ref) ?? 0,
					strokes: s.nr ? null : (s.strokes ?? null),
				});
			});
		}
		return results;
	},
});
