export interface RoundStatInput {
	holeCount: number;
	strokes: number; // owner total strokes (nulls counted 0 upstream)
	vsPar: number; // owner vs par for the round
	putts: number | null; // total putts, null if none recorded
	holesWithPutts: number; // holes that had a putt value
	firMade: number;
	firEligible: number; // non-par-3 holes with a FIR value recorded
	girMade: number;
	girHoles: number; // holes with a GIR value recorded
}

export interface AggregateStats {
	rounds: number;
	avgScore: number | null; // mean strokes over 18-hole rounds
	avgVsPar: number | null; // mean vs par over 18-hole rounds
	puttsPer18: number | null; // pooled putts/hole × 18
	firPct: number | null; // pooled fairways hit
	girPct: number | null; // pooled greens in regulation
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

const ratio = (made: number, total: number): number | null =>
	total > 0 ? made / total : null;

export function aggregateStats(
	rounds: ReadonlyArray<RoundStatInput>,
): AggregateStats {
	const full = rounds.filter((r) => r.holeCount === 18);
	const avgScore =
		full.length > 0
			? round1(full.reduce((t, r) => t + r.strokes, 0) / full.length)
			: null;
	const avgVsPar =
		full.length > 0
			? round1(full.reduce((t, r) => t + r.vsPar, 0) / full.length)
			: null;

	const puttHoles = rounds.reduce((t, r) => t + r.holesWithPutts, 0);
	const puttTotal = rounds.reduce((t, r) => t + (r.putts ?? 0), 0);
	const puttsPer18 =
		puttHoles > 0 ? round1((puttTotal / puttHoles) * 18) : null;

	return {
		rounds: rounds.length,
		avgScore,
		avgVsPar,
		puttsPer18,
		firPct: ratio(
			rounds.reduce((t, r) => t + r.firMade, 0),
			rounds.reduce((t, r) => t + r.firEligible, 0),
		),
		girPct: ratio(
			rounds.reduce((t, r) => t + r.girMade, 0),
			rounds.reduce((t, r) => t + r.girHoles, 0),
		),
	};
}
