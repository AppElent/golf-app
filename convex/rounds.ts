import {
	roundDifferential,
	roundPlayingHandicap,
	WHS_WINDOW,
} from "@fairway/core/handicap";
import { checkHoleRefs } from "@fairway/core/loops";
import {
	countedStrokes,
	OWNER_INDEX,
	ownerRoundStats,
	playerStrokes,
	scoreAt,
} from "@fairway/core/round";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { canSee } from "./courses";
import { getUserId } from "./lib";
import { upsertSettings } from "./settings";
import { roundFormat, scoreUpdateFields } from "./validators";

const playerInput = v.object({
	name: v.string(),
	handicapIndex: v.optional(v.number()),
});

/** The round being played for real; a simulation runs alongside it. */
function findActiveRound(ctx: QueryCtx, userId: string) {
	return ctx.db
		.query("rounds")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.filter((q) =>
			q.and(
				q.eq(q.field("status"), "active"),
				q.neq(q.field("simulated"), true),
			),
		)
		.first();
}

function findSimulation(ctx: QueryCtx, userId: string) {
	return ctx.db
		.query("rounds")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.filter((q) => q.eq(q.field("simulated"), true))
		.first();
}

/** The user's finished rounds, newest first. */
async function finishedRounds(
	ctx: QueryCtx,
	userId: string,
	limit = WHS_WINDOW,
) {
	const rounds = await ctx.db
		.query("rounds")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.filter((q) => q.eq(q.field("status"), "finished"))
		.collect();
	rounds.sort((a, b) => b.startedAt - a.startedAt);
	return rounds.slice(0, limit);
}

function courseHoles(ctx: QueryCtx, courseId: Id<"courses">) {
	return ctx.db
		.query("holes")
		.withIndex("by_course", (q) => q.eq("courseId", courseId))
		.collect();
}

function roundScores(ctx: QueryCtx, roundId: Id<"rounds">) {
	return ctx.db
		.query("holeScores")
		.withIndex("by_round", (q) => q.eq("roundId", roundId))
		.collect();
}

/** The round's own holes in play order. `start` guarantees each has par and
 *  stroke index, and a catalog sync retires holes rounds use rather than
 *  deleting them; a value since cleared on a user's copy reads as 0. */
function holesOfRound(
	round: Doc<"rounds">,
	holes: Doc<"holes">[],
	teeMarker?: string,
) {
	const byRef = new Map(holes.map((h) => [h.ref, h]));
	return round.holeRefs.map((ref) => {
		const hole = byRef.get(ref);
		return {
			ref,
			par: hole?.par ?? 0,
			strokeIndex: hole?.strokeIndex ?? 0,
			lengthMeters:
				(teeMarker ? hole?.lengths?.[teeMarker] : undefined) ??
				hole?.lengthMeters,
		};
	});
}

/** A round with everything the round screens show. */
async function assembleRound(ctx: QueryCtx, round: Doc<"rounds">) {
	const [course, tee, holes, scores] = await Promise.all([
		ctx.db.get(round.courseId),
		ctx.db.get(round.teeId),
		courseHoles(ctx, round.courseId),
		roundScores(ctx, round._id),
	]);
	if (!course || !tee) return null;
	return {
		round: { ...round, currentHoleIndex: round.currentHoleIndex ?? 0 },
		course,
		tee,
		holes: holesOfRound(round, holes, tee.marker),
		scores,
	};
}

/** Load once per course within one query: a golfer's rounds share few courses. */
function perCourse<T>(load: (courseId: Id<"courses">) => Promise<T>) {
	const loaded = new Map<Id<"courses">, Promise<T>>();
	return (courseId: Id<"courses">) => {
		const value = loaded.get(courseId) ?? load(courseId);
		loaded.set(courseId, value);
		return value;
	};
}

/** The round, if it is the signed-in user's. */
export async function requireOwnRound(ctx: QueryCtx, roundId: Id<"rounds">) {
	const userId = await getUserId(ctx);
	const round = await ctx.db.get(roundId);
	if (!round || round.userId !== userId) throw new Error("Round not found.");
	return round;
}

/** The round, if it is the signed-in user's and being played. */
export async function requireActiveRound(ctx: QueryCtx, roundId: Id<"rounds">) {
	const round = await requireOwnRound(ctx, roundId);
	if (round.status !== "active") throw new Error("Round is not active.");
	return round;
}

export function assertHoleOfRound(round: Doc<"rounds">, holeIndex: number) {
	if (holeIndex < 0 || holeIndex >= round.holeRefs.length) {
		throw new Error("holeIndex out of range.");
	}
}

/**
 * Start a round. Validates every selected hole has par + stroke index
 * (scoring math needs them) and computes each player's playing handicap
 * server-side from the tee's CR/slope and the selected holes' par total.
 * A `simulated` round replaces the user's previous simulation, leaves their real
 * round alone, and doesn't touch their profile.
 */
export const start = mutation({
	args: {
		courseId: v.id("courses"),
		teeId: v.id("tees"),
		holeRefs: v.array(v.string()),
		loopLabel: v.optional(v.string()),
		format: roundFormat,
		players: v.array(playerInput),
		simulated: v.optional(v.boolean()),
	},
	handler: async (ctx, { simulated, ...args }) => {
		const userId = await getUserId(ctx);

		const existing = await findActiveRound(ctx, userId);
		if (existing && !simulated) {
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
		if (!course || course.retired || !canSee(course, userId)) {
			throw new Error("Course not found.");
		}
		const tee = await ctx.db.get(args.teeId);
		if (!tee || tee.courseId !== args.courseId || tee.retired) {
			throw new Error("Tee does not belong to this course.");
		}

		const { par, incomplete } = checkHoleRefs(
			args.holeRefs,
			(await courseHoles(ctx, args.courseId)).filter((h) => !h.retired),
		);
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
							par,
							args.holeRefs.length,
						),
		}));

		if (simulated) {
			const previous = await findSimulation(ctx, userId);
			if (previous) await deleteRoundData(ctx, previous._id);
		}

		// The index you tee off with is your current one: keep the profile in step.
		const ownerIndex = args.players[OWNER_INDEX].handicapIndex;
		if (ownerIndex !== undefined && !simulated) {
			await upsertSettings(ctx, userId, { handicapIndex: ownerIndex });
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
			...(simulated ? { simulated: true } : {}),
		});
	},
});

/** The user's active round, assembled for the scorecard/play screens. */
export const active = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const round = await findActiveRound(ctx, userId);
		return round ? assembleRound(ctx, round) : null;
	},
});

/** The user's simulated round, assembled like `active`. */
export const activeSimulation = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const round = await findSimulation(ctx, userId);
		return round ? assembleRound(ctx, round) : null;
	},
});

export async function deleteRoundData(ctx: MutationCtx, roundId: Id<"rounds">) {
	const [scores, shots] = await Promise.all([
		roundScores(ctx, roundId),
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
		queued: v.optional(v.boolean()),
		...scoreUpdateFields,
	},
	handler: async (
		ctx,
		{ roundId, holeIndex, playerIndex, queued, ...args },
	) => {
		await getUserId(ctx);
		// A web queue can still hold scores for a round deleted since. They have
		// nowhere to go, and failing would block the queue's other scores for good.
		if (!(await ctx.db.get(roundId))) return;
		// Same for a round finished since. The phone saves live, so it must hear
		// that this score was not stored.
		if (queued && (await requireOwnRound(ctx, roundId)).status !== "active") {
			return;
		}
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
		assertHoleOfRound(round, holeIndex);
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
		assertHoleOfRound(round, holeIndex);
		await ctx.db.patch(roundId, { currentHoleIndex: holeIndex });
	},
});

/** Delete the active round with its scores and shots. */
export const abandon = mutation({
	args: { roundId: v.id("rounds") },
	handler: async (ctx, { roundId }) => {
		await requireActiveRound(ctx, roundId);
		await deleteRoundData(ctx, roundId);
	},
});

/**
 * Finish the round: stamp the owner's WHS score differential, where the round
 * can count for one. Totals are computed from holeScores when read. A simulated
 * round is deleted instead, so it never reaches history or the handicap.
 */
export const finish = mutation({
	args: { roundId: v.id("rounds") },
	handler: async (ctx, { roundId }) => {
		const round = await requireActiveRound(ctx, roundId);
		if (round.simulated) {
			await deleteRoundData(ctx, roundId);
			return;
		}
		const [tee, allHoles, scores] = await Promise.all([
			ctx.db.get(round.teeId),
			courseHoles(ctx, round.courseId),
			roundScores(ctx, round._id),
		]);
		if (!tee) throw new Error("Tee not found.");

		const holes = holesOfRound(round, allHoles);
		const owner = round.players[OWNER_INDEX];
		const differential =
			owner.playingHandicap === undefined
				? null
				: roundDifferential({
						holes,
						strokes: playerStrokes(holes.length, scores, OWNER_INDEX),
						playingHandicap: owner.playingHandicap,
						handicapIndex: owner.handicapIndex,
						tee,
					});

		await ctx.db.patch(roundId, {
			status: "finished",
			scoreDifferential: differential,
		});
	},
});

/**
 * Finished rounds, newest first, with the owner's summary, recomputed from
 * holeScores so rounds finished before a stat existed still have it.
 */
export const history = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => {
		const userId = await getUserId(ctx);
		const rounds = await finishedRounds(ctx, userId, limit);
		const holesOf = perCourse((courseId) => courseHoles(ctx, courseId));
		const nameOf = perCourse(
			async (courseId) =>
				(await ctx.db.get(courseId))?.name ?? "Unknown course",
		);

		return await Promise.all(
			rounds.map(async (round) => {
				const [courseName, holes, scores] = await Promise.all([
					nameOf(round.courseId),
					holesOf(round.courseId),
					roundScores(ctx, round._id),
				]);
				return {
					_id: round._id,
					startedAt: round.startedAt,
					courseName,
					loopLabel: round.loopLabel ?? null,
					format: round.format,
					holeCount: round.holeRefs.length,
					differential: round.scoreDifferential ?? null,
					owner: ownerRoundStats(holesOfRound(round, holes), scores),
				};
			}),
		);
	},
});

/** One of the user's rounds (any status) with course, tee, holes and scores. */
export const detail = query({
	args: { roundId: v.id("rounds") },
	handler: async (ctx, { roundId }) => {
		const userId = await getUserId(ctx);
		const round = await ctx.db.get(roundId);
		if (!round || round.userId !== userId) return null;
		return assembleRound(ctx, round);
	},
});

/** Delete one of the user's rounds, whatever its status. */
export const remove = mutation({
	args: { roundId: v.id("rounds") },
	handler: async (ctx, { roundId }) => {
		await requireOwnRound(ctx, roundId);
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
		const rounds = await finishedRounds(ctx, userId, limit);
		const holesOf = perCourse((courseId) => courseHoles(ctx, courseId));
		const results: Array<{ par: number; strokes: number | null }> = [];
		for (const round of rounds) {
			const holes = holesOfRound(round, await holesOf(round.courseId));
			const scores = await roundScores(ctx, round._id);
			holes.forEach((hole, holeIndex) => {
				const s = scoreAt(scores, holeIndex, OWNER_INDEX);
				if (s) results.push({ par: hole.par, strokes: countedStrokes(s) });
			});
		}
		return results;
	},
});
