import { strokesPerHole } from "./scoring";

export function courseHandicap(
	handicapIndex: number,
	slopeRating: number,
	courseRating: number,
	par: number,
): number {
	return handicapIndex * (slopeRating / 113) + (courseRating - par);
}

export function playingHandicap(
	handicapIndex: number,
	slopeRating: number,
	courseRating: number,
	par: number,
	allowance = 1,
): number {
	return Math.round(
		courseHandicap(handicapIndex, slopeRating, courseRating, par) * allowance,
	);
}

/**
 * How many holes a course rating covers. 9-hole ratings (about 27–37) sit far
 * below any 18-hole rating (about 55–80), so the rating itself tells.
 */
export function ratedHoles(courseRating: number): 9 | 18 {
	return courseRating < 45 ? 9 : 18;
}

/**
 * The course rating for a round of `holeCount` holes on a tee: half the
 * tee's 18-hole rating for 9 holes, double a 9-hole rating for 18 holes.
 */
export function roundCourseRating(
	courseRating: number,
	holeCount: number,
): number {
	const nine = holeCount <= 9;
	const rated = ratedHoles(courseRating);
	if (nine && rated === 18) return courseRating / 2;
	if (!nine && rated === 9) return courseRating * 2;
	return courseRating;
}

/**
 * WHS playing handicap for a round of `holeCount` holes on a tee. A 9-hole
 * round uses half the index and a 9-hole course rating. `par` is the
 * round's par.
 */
export function roundPlayingHandicap(
	handicapIndex: number,
	tee: { slopeRating: number; courseRating: number },
	par: number,
	holeCount: number,
	allowance = 1,
): number {
	return playingHandicap(
		holeCount <= 9 ? handicapIndex / 2 : handicapIndex,
		tee.slopeRating,
		roundCourseRating(tee.courseRating, holeCount),
		par,
		allowance,
	);
}

/**
 * WHS adjusted gross score: every hole capped at net double bogey
 * (par + 2 + strokes received). Callers must pass fully played rounds —
 * rounds containing NR holes don't produce a differential.
 */
export function adjustedGrossScore(
	holes: ReadonlyArray<{ par: number; strokeIndex: number }>,
	strokes: ReadonlyArray<number>,
	playingHcp: number,
): number {
	const received = strokesPerHole(holes, playingHcp);
	return holes.reduce((total, hole, i) => {
		const cap = hole.par + 2 + received[i];
		return total + Math.min(strokes[i], cap);
	}, 0);
}

export function scoreDifferential(
	adjustedGross: number,
	courseRating: number,
	slopeRating: number,
): number {
	const raw = (113 / slopeRating) * (adjustedGross - courseRating);
	return Math.round(raw * 10) / 10;
}

/**
 * Expected 9-hole score differential for a handicap index, used by WHS (and
 * the NGF) since 2024 to turn a 9-hole score into an 18-hole differential.
 * The official formula is unpublished; this linear fit reproduces the
 * published worked examples to within 0.1.
 */
export function expectedNineHoleDifferential(handicapIndex: number): number {
	return Math.round((0.52 * handicapIndex + 1.2) * 10) / 10;
}

/**
 * The 18-hole score differential a finished round counts for, or null when
 * it can't count: only 9 or 18 holes, every stroke entered. A 9-hole round
 * adds the expected differential for the index it was played off, so it
 * needs `handicapIndex`.
 */
export function roundDifferential(round: {
	holes: ReadonlyArray<{ par: number; strokeIndex: number }>;
	strokes: ReadonlyArray<number | null>;
	playingHandicap: number;
	handicapIndex?: number;
	tee: { slopeRating: number; courseRating: number };
}): number | null {
	const count = round.holes.length;
	if (count !== 9 && count !== 18) return null;
	if (round.strokes.some((s) => s === null)) return null;
	const gross = adjustedGrossScore(
		round.holes,
		round.strokes as number[],
		round.playingHandicap,
	);
	const differential = scoreDifferential(
		gross,
		roundCourseRating(round.tee.courseRating, count),
		round.tee.slopeRating,
	);
	if (count === 18) return differential;
	if (round.handicapIndex === undefined) return null;
	return (
		Math.round(
			(differential + expectedNineHoleDifferential(round.handicapIndex)) * 10,
		) / 10
	);
}

/** WHS small-sample table: how many differentials count + adjustment. */
const SMALL_SAMPLE: Record<number, { count: number; adjustment: number }> = {
	3: { count: 1, adjustment: -2 },
	4: { count: 1, adjustment: -1 },
	5: { count: 1, adjustment: 0 },
	6: { count: 2, adjustment: -1 },
	7: { count: 2, adjustment: 0 },
	8: { count: 2, adjustment: 0 },
	9: { count: 3, adjustment: 0 },
	10: { count: 3, adjustment: 0 },
	11: { count: 3, adjustment: 0 },
	12: { count: 4, adjustment: 0 },
	13: { count: 4, adjustment: 0 },
	14: { count: 4, adjustment: 0 },
	15: { count: 5, adjustment: 0 },
	16: { count: 5, adjustment: 0 },
	17: { count: 6, adjustment: 0 },
	18: { count: 6, adjustment: 0 },
	19: { count: 7, adjustment: 0 },
};

/**
 * "Would-be" handicap index from chronological differentials (oldest first).
 * Not an official index — official handicaps stay with the NGF.
 */
export function wouldBeIndex(
	differentials: ReadonlyArray<number>,
): number | null {
	if (differentials.length < 3) return null;
	const recent = differentials.slice(-20);
	const { count, adjustment } =
		recent.length >= 20
			? { count: 8, adjustment: 0 }
			: SMALL_SAMPLE[recent.length];
	const best = [...recent].sort((a, b) => a - b).slice(0, count);
	const avg = best.reduce((total, d) => total + d, 0) / count;
	return Math.round((avg + adjustment) * 10) / 10;
}

/**
 * Running would-be index after each round, oldest first. Emits one entry per
 * round once at least three differentials are available (before that WHS has no
 * index). Nulls are filtered — every entry is a real number for the sparkline.
 */
export function wouldBeIndexHistory(
	differentials: ReadonlyArray<number>,
): number[] {
	const history: number[] = [];
	for (let i = 3; i <= differentials.length; i++) {
		const index = wouldBeIndex(differentials.slice(0, i));
		if (index !== null) history.push(index);
	}
	return history;
}
