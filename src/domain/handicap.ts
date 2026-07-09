import { strokesReceived } from "./scoring";

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
 * WHS adjusted gross score: every hole capped at net double bogey
 * (par + 2 + strokes received). Callers must pass fully played rounds —
 * rounds containing NR holes don't produce a differential.
 */
export function adjustedGrossScore(
	holes: ReadonlyArray<{ par: number; strokeIndex: number }>,
	strokes: ReadonlyArray<number>,
	playingHcp: number,
): number {
	return holes.reduce((total, hole, i) => {
		const cap = hole.par + 2 + strokesReceived(hole.strokeIndex, playingHcp);
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
