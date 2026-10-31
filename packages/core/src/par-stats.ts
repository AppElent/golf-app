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

/** Count of results per score-to-par bucket, for a scoring distribution. */
export function scoringDistribution(results: ReadonlyArray<HoleResult>): {
	eagles: number;
	birdies: number;
	pars: number;
	bogeys: number;
	doubles: number;
} {
	const out = { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0 };
	for (const r of results) {
		if (r.strokes === null || r.par === 0) continue;
		const diff = r.strokes - r.par;
		if (diff <= -2) out.eagles += 1;
		else if (diff === -1) out.birdies += 1;
		else if (diff === 0) out.pars += 1;
		else if (diff === 1) out.bogeys += 1;
		else out.doubles += 1;
	}
	return out;
}
