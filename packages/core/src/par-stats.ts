import { type ScoreMark, scoreMark } from "./scoring";

export interface HoleResult {
	par: number;
	strokes: number | null;
}

export interface ParTypeAverage {
	par: 3 | 4 | 5;
	/** Average strokes on holes of this par, null without data. */
	average: number | null;
	holes: number;
}

/** Scoring average per par type (par 3s, 4s, 5s), NR holes excluded. */
export function parTypeAverages(
	results: ReadonlyArray<HoleResult>,
): ParTypeAverage[] {
	return ([3, 4, 5] as const).map((par) => {
		const strokes = results
			.filter((r) => r.par === par && r.strokes !== null)
			.map((r) => r.strokes as number);
		return {
			par,
			average:
				strokes.length > 0
					? Math.round(
							(strokes.reduce((t, s) => t + s, 0) / strokes.length) * 100,
						) / 100
					: null,
			holes: strokes.length,
		};
	});
}

/** Count of results per score-to-par mark, for a scoring distribution. */
export function scoringDistribution(
	results: ReadonlyArray<HoleResult>,
): Record<ScoreMark, number> {
	const counts: Record<ScoreMark, number> = {
		eagle: 0,
		birdie: 0,
		par: 0,
		bogey: 0,
		double: 0,
	};
	for (const r of results) {
		const mark = r.par === 0 ? null : scoreMark(r.par, r.strokes);
		if (mark) counts[mark] += 1;
	}
	return counts;
}
