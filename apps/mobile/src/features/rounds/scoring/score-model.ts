import { type HoleScore, scoreAt } from "@fairway/core/round";

/** What the sheet edits for one player on one hole. */
export interface ScoreDraft {
	strokes: number;
	putts: number | null;
	fir: boolean | null;
	gir: boolean | null;
	penalties: number;
	/** Picked up: no score on this hole (counts 0 Stableford points). */
	nr: boolean;
}

export function initialDrafts(
	scores: readonly HoleScore[],
	holeIndex: number,
	playerCount: number,
	par: number,
): ScoreDraft[] {
	return Array.from({ length: playerCount }, (_, playerIndex) => {
		const s = scoreAt(scores, holeIndex, playerIndex);
		return {
			strokes: s?.strokes ?? par,
			putts: s?.putts ?? null,
			fir: s?.fir ?? null,
			gir: s?.gir ?? null,
			penalties: s?.penalties ?? 0,
			nr: s?.nr ?? false,
		};
	});
}

/** Birdie, par, bogey, double (never below 1). */
export function quickStrokes(par: number): number[] {
	return [par - 1, par, par + 1, par + 2].filter((n) => n >= 1);
}
