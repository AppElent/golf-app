export interface HoleInfo {
	number: number;
	par: number;
	strokeIndex: number;
}

/**
 * WHS stroke allocation: positive playing handicaps receive strokes starting
 * at stroke index 1; plus (negative) handicaps give strokes back starting at
 * stroke index 18.
 */
export function strokesReceived(
	strokeIndex: number,
	playingHandicap: number,
): number {
	if (playingHandicap >= 0) {
		const base = Math.floor(playingHandicap / 18);
		const extra = strokeIndex <= playingHandicap % 18 ? 1 : 0;
		return base + extra;
	}
	const plus = Math.abs(playingHandicap);
	const base = Math.floor(plus / 18);
	const extra = strokeIndex > 18 - (plus % 18) ? 1 : 0;
	const total = base + extra;
	return total === 0 ? 0 : -total;
}

/** null strokes = hole not played / picked up → 0 points. */
export function stablefordPoints(
	hole: Pick<HoleInfo, "par" | "strokeIndex">,
	strokes: number | null,
	playingHandicap: number,
): number {
	if (strokes === null) return 0;
	const received = strokesReceived(hole.strokeIndex, playingHandicap);
	return Math.max(0, 2 + hole.par + received - strokes);
}

export function totalStrokes(strokes: ReadonlyArray<number | null>): number {
	return strokes.reduce<number>((total, s) => total + (s ?? 0), 0);
}

export function vsPar(
	holes: ReadonlyArray<Pick<HoleInfo, "par">>,
	strokes: ReadonlyArray<number | null>,
): number {
	return holes.reduce((total, hole, i) => {
		const s = strokes[i];
		return s == null ? total : total + (s - hole.par);
	}, 0);
}

export function formatVsPar(diff: number): string {
	if (diff === 0) return "E";
	return diff > 0 ? `+${diff}` : `${diff}`;
}

export type ScoreMark = "eagle" | "birdie" | "par" | "bogey" | "double";

/** Classic scorecard notation class for a hole result (spec §3). */
export function scoreMark(
	par: number,
	strokes: number | null,
): ScoreMark | null {
	if (strokes === null) return null;
	const diff = strokes - par;
	if (diff <= -2) return "eagle";
	if (diff === -1) return "birdie";
	if (diff === 0) return "par";
	if (diff === 1) return "bogey";
	return "double";
}

/** Chunk stroke totals (Out/In nines). Nulls count 0; trailing partial chunk kept. */
export function splitTotals(
	strokes: ReadonlyArray<number | null>,
	size: number,
): number[] {
	const totals: number[] = [];
	for (let i = 0; i < strokes.length; i += size) {
		totals.push(totalStrokes(strokes.slice(i, i + size)));
	}
	return totals;
}
