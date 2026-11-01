export interface HoleInfo {
	number: number;
	par: number;
	strokeIndex: number;
}

/**
 * WHS stroke allocation over `holeCount` holes: positive playing handicaps
 * receive strokes starting at stroke index 1; plus (negative) handicaps give
 * strokes back starting at the highest index.
 */
export function strokesReceived(
	strokeIndex: number,
	playingHandicap: number,
	holeCount = 18,
): number {
	if (playingHandicap >= 0) {
		const base = Math.floor(playingHandicap / holeCount);
		const extra = strokeIndex <= playingHandicap % holeCount ? 1 : 0;
		return base + extra;
	}
	const plus = Math.abs(playingHandicap);
	const base = Math.floor(plus / holeCount);
	const extra = strokeIndex > holeCount - (plus % holeCount) ? 1 : 0;
	const total = base + extra;
	return total === 0 ? 0 : -total;
}

/**
 * Strokes received on each hole of a round. The card's stroke indexes are
 * ranked within the round's own holes, so a 9-hole loop allocates over 1–9
 * (a 9-hole playing handicap of 9 is a stroke on every hole, not on the
 * loop's holes that happen to have SI ≤ 9). Identity for a full 18.
 */
export function strokesPerHole(
	holes: ReadonlyArray<Pick<HoleInfo, "strokeIndex">>,
	playingHandicap: number,
): number[] {
	const order = holes
		.map((hole, i) => ({ si: hole.strokeIndex, i }))
		.sort((a, b) => a.si - b.si || a.i - b.i);
	const rank = new Array<number>(holes.length);
	order.forEach(({ i }, r) => {
		rank[i] = r + 1;
	});
	return rank.map((r) => strokesReceived(r, playingHandicap, holes.length));
}

/** null strokes = hole not played / picked up → 0 points. */
export function stablefordPoints(
	hole: Pick<HoleInfo, "par">,
	strokes: number | null,
	received: number,
): number {
	if (strokes === null) return 0;
	return Math.max(0, 2 + hole.par + received - strokes);
}

/** Stableford points for a round, strokes allocated over its own holes. */
export function stablefordTotal(
	holes: ReadonlyArray<Pick<HoleInfo, "par" | "strokeIndex">>,
	strokes: ReadonlyArray<number | null>,
	playingHandicap: number,
): number {
	const received = strokesPerHole(holes, playingHandicap);
	return holes.reduce(
		(total, hole, i) =>
			total + stablefordPoints(hole, strokes[i] ?? null, received[i]),
		0,
	);
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
