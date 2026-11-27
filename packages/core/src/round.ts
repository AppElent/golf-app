/**
 * A round as it is stored: per-player results on each hole, with player 0 as
 * the account owner. Every target reads a round through these rules.
 */
import { totalStrokes, vsPar } from "./scoring";

export type RoundFormat =
	| "stroke"
	| "stableford"
	| "match"
	| "skins"
	| "sixes"
	| "scramble";

/** How a match, skins, sixes or scramble round is scored. Absent = net, carry-over on. */
export interface FormatOptions {
	scoring: "net" | "gross";
	/** Skins: a tied hole's skin goes to the next hole. */
	carryOver?: boolean;
}

/** A scramble team; a scramble's scores are stored per team, not per player. */
export interface RoundTeam {
	playerIndexes: number[];
}

/** The account owner is always the first player of a round. */
export const OWNER_INDEX = 0;

/** Where a tee shot that missed the fairway ended up. */
export type MissSide = "left" | "right";

/** One player's stored result on one hole. */
export interface HoleScore {
	holeIndex: number;
	/** The team index in a scramble round (team 0 holds the owner). */
	playerIndex: number;
	strokes?: number;
	putts?: number;
	fir?: boolean;
	/** Only when `fir` is false; older scores don't have it. */
	firMiss?: MissSide;
	gir?: boolean;
	/** Was in a bunker on this hole. */
	bunker?: boolean;
	penalties?: number;
	/** Picked up: no score on this hole. */
	nr?: boolean;
}

/** A write to one result: omitted fields keep their value, `null` clears. */
export interface ScoreUpdate {
	strokes?: number | null;
	putts?: number | null;
	fir?: boolean | null;
	firMiss?: MissSide | null;
	gir?: boolean | null;
	bunker?: boolean | null;
	penalties?: number;
	nr?: boolean;
}

export function scoreAt<S extends Pick<HoleScore, "holeIndex" | "playerIndex">>(
	scores: ReadonlyArray<S>,
	holeIndex: number,
	playerIndex: number,
): S | undefined {
	return scores.find(
		(s) => s.holeIndex === holeIndex && s.playerIndex === playerIndex,
	);
}

/** Strokes or a pick-up; a row whose strokes were cleared holds neither. */
export function hasResult(
	score: Pick<HoleScore, "strokes" | "nr"> | undefined,
): boolean {
	return score?.nr === true || score?.strokes !== undefined;
}

/** The strokes a result counts for: null when unplayed or picked up. */
export function countedStrokes(
	score: Pick<HoleScore, "strokes" | "nr"> | undefined,
): number | null {
	return score?.nr ? null : (score?.strokes ?? null);
}

export function playerStrokes(
	holeCount: number,
	scores: ReadonlyArray<HoleScore>,
	playerIndex: number,
): (number | null)[] {
	return Array.from({ length: holeCount }, (_, holeIndex) =>
		countedStrokes(scoreAt(scores, holeIndex, playerIndex)),
	);
}

/**
 * Every side's net score on a hole, `null` for a pick-up. `null` as a whole
 * until each side has a result: no format settles a half-entered hole.
 */
export function holeNets(
	scores: ReadonlyArray<HoleScore>,
	holeIndex: number,
	received: ReadonlyArray<ReadonlyArray<number>>,
): (number | null)[] | null {
	const nets: (number | null)[] = [];
	for (const [side, strokes] of received.entries()) {
		const score = scoreAt(scores, holeIndex, side);
		if (score?.nr) nets.push(null);
		else if (score?.strokes !== undefined) {
			nets.push(score.strokes - (strokes[holeIndex] ?? 0));
		} else return null;
	}
	return nets;
}

/** Ordering value of a net score: a pick-up loses to every score. */
export const netRank = (net: number | null): number => net ?? Infinity;

/** The owner's holes with strokes or a pick-up, in order. */
export function playedHoles(
	holeCount: number,
	scores: ReadonlyArray<HoleScore>,
	playerIndex = OWNER_INDEX,
): number[] {
	const done = new Set(
		scores
			.filter(
				(s) =>
					s.playerIndex === playerIndex && (s.strokes !== undefined || s.nr),
			)
			.map((s) => s.holeIndex),
	);
	return Array.from({ length: holeCount }, (_, i) => i).filter((i) =>
		done.has(i),
	);
}

/** A stored result knows when it was first entered; a correction keeps that. */
export type RecordedScore = HoleScore & { _creationTime?: number };

/** The hole indexes in card order. */
export const cardOrder = (holeCount: number): number[] =>
	Array.from({ length: holeCount }, (_, i) => i);

/**
 * The hole indexes in the order played. A round that stores its start hole
 * plays from it and wraps around (a shotgun start on hole 10 ends on 9).
 *
 * A round without one (started on a phone from before APP-913) infers it:
 * its first entered hole is the start, once the last hole was entered
 * before any hole in front of that start. Any other order stays in
 * card order, as does a start on hole 2: entry times can't tell it from a
 * hole 1 that was forgotten and entered last.
 */
export function playingOrder(
	holeCount: number,
	scores: ReadonlyArray<RecordedScore>,
	startHoleIndex?: number,
): number[] {
	const order = cardOrder(holeCount);
	if (
		startHoleIndex !== undefined &&
		Number.isInteger(startHoleIndex) &&
		startHoleIndex >= 0 &&
		startHoleIndex < holeCount
	) {
		return [...order.slice(startHoleIndex), ...order.slice(0, startHoleIndex)];
	}
	// A result being entered now has no time yet: the latest.
	const enteredAt = order.map((holeIndex) =>
		Math.min(
			...scores
				.filter((s) => s.holeIndex === holeIndex && hasResult(s))
				.map((s) => s._creationTime ?? Number.MAX_VALUE),
		),
	);
	const start = enteredAt.indexOf(Math.min(...enteredAt));
	const wraps =
		start > 1 &&
		enteredAt.slice(0, start).every((time) => time > enteredAt[holeCount - 1]);
	return wraps ? [...order.slice(start), ...order.slice(0, start)] : order;
}

/** Fairway hit only means something off a par-4 or par-5 tee. */
export const hasFairway = (par: number): boolean => par > 3;

/**
 * Green in regulation from strokes and putts: on in par − 2 or fewer.
 * Unknown (null) for a picked-up hole, without putts, and when there is no
 * stroke left before the putts.
 */
export function derivedGir(
	par: number,
	score: { strokes: number | null; putts: number | null; nr: boolean },
): boolean | null {
	const { strokes, putts, nr } = score;
	if (nr || strokes === null || putts === null || putts >= strokes) return null;
	return strokes - putts <= par - 2;
}

export interface OwnerRoundStats {
	strokes: number;
	vsPar: number;
	/** Total putts, null if none were recorded. Picked-up holes are left out. */
	putts: number | null;
	/** Holes with recorded putts, not counting picked-up holes. */
	holesWithPutts: number;
	firMade: number;
	/** Holes with a fairway and a recorded fairway result. */
	firEligible: number;
	/** Missed fairways with a recorded side; older misses have none. */
	firMissLeft: number;
	firMissRight: number;
	girMade: number;
	/** Holes with a recorded green result. */
	girHoles: number;
}

export function ownerRoundStats(
	holes: ReadonlyArray<{ par: number }>,
	scores: ReadonlyArray<HoleScore>,
): OwnerRoundStats {
	const strokes = playerStrokes(holes.length, scores, OWNER_INDEX);
	const stats = {
		putts: 0,
		holesWithPutts: 0,
		firMade: 0,
		firEligible: 0,
		firMissLeft: 0,
		firMissRight: 0,
		girMade: 0,
		girHoles: 0,
	};
	holes.forEach((hole, holeIndex) => {
		const s = scoreAt(scores, holeIndex, OWNER_INDEX);
		// A picked-up hole never holed out, so its putts are not a putting
		// result. Its tee shot still is, so the fairway below still counts.
		if (s?.putts !== undefined && !s.nr) {
			stats.putts += s.putts;
			stats.holesWithPutts += 1;
		}
		if (hasFairway(hole.par) && s?.fir !== undefined) {
			stats.firEligible += 1;
			if (s.fir) stats.firMade += 1;
			else if (s.firMiss === "left") stats.firMissLeft += 1;
			else if (s.firMiss === "right") stats.firMissRight += 1;
		}
		if (s?.gir !== undefined) {
			stats.girHoles += 1;
			if (s.gir) stats.girMade += 1;
		}
	});
	return {
		...stats,
		strokes: totalStrokes(strokes),
		vsPar: vsPar(holes, strokes),
		putts: stats.holesWithPutts > 0 ? stats.putts : null,
	};
}
