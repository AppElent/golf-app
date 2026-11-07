/**
 * A round as it is stored: per-player results on each hole, with player 0 as
 * the account owner. Every target reads a round through these rules.
 */
import { totalStrokes, vsPar } from "./scoring";

export type RoundFormat = "stroke" | "stableford";

/** The account owner is always the first player of a round. */
export const OWNER_INDEX = 0;

/** One player's stored result on one hole. */
export interface HoleScore {
	holeIndex: number;
	playerIndex: number;
	strokes?: number;
	putts?: number;
	fir?: boolean;
	gir?: boolean;
	penalties?: number;
	/** Picked up: no score on this hole. */
	nr?: boolean;
}

/** A write to one result: omitted fields keep their value, `null` clears. */
export interface ScoreUpdate {
	strokes?: number;
	putts?: number | null;
	fir?: boolean | null;
	gir?: boolean | null;
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

/** The owner's holes with strokes or a pick-up, in order. */
export function playedHoles(
	holeCount: number,
	scores: ReadonlyArray<HoleScore>,
): number[] {
	const done = new Set(
		scores
			.filter(
				(s) =>
					s.playerIndex === OWNER_INDEX && (s.strokes !== undefined || s.nr),
			)
			.map((s) => s.holeIndex),
	);
	return Array.from({ length: holeCount }, (_, i) => i).filter((i) =>
		done.has(i),
	);
}

/** Fairway hit only means something off a par-4 or par-5 tee. */
export const hasFairway = (par: number): boolean => par > 3;

export interface OwnerRoundStats {
	strokes: number;
	vsPar: number;
	/** Total putts, null if none were recorded. */
	putts: number | null;
	holesWithPutts: number;
	firMade: number;
	/** Holes with a fairway and a recorded fairway result. */
	firEligible: number;
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
		girMade: 0,
		girHoles: 0,
	};
	holes.forEach((hole, holeIndex) => {
		const s = scoreAt(scores, holeIndex, OWNER_INDEX);
		if (s?.putts !== undefined) {
			stats.putts += s.putts;
			stats.holesWithPutts += 1;
		}
		if (hasFairway(hole.par) && s?.fir !== undefined) {
			stats.firEligible += 1;
			if (s.fir) stats.firMade += 1;
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
