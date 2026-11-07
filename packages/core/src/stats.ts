import type { OwnerRoundStats } from "./round";

export interface RoundStatInput {
	holeCount: number;
	owner: OwnerRoundStats;
}

export interface AggregateStats {
	rounds: number;
	avgScore: number | null; // mean strokes over 18-hole rounds
	avgVsPar: number | null; // mean vs par over 18-hole rounds
	avgScore9: number | null; // the same over 9-hole rounds
	avgVsPar9: number | null;
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
	const mean = (holes: number, pick: (r: OwnerRoundStats) => number) => {
		const of = rounds.filter((r) => r.holeCount === holes);
		return of.length > 0
			? round1(of.reduce((t, r) => t + pick(r.owner), 0) / of.length)
			: null;
	};

	const puttHoles = rounds.reduce((t, r) => t + r.owner.holesWithPutts, 0);
	const puttTotal = rounds.reduce((t, r) => t + (r.owner.putts ?? 0), 0);
	const puttsPer18 =
		puttHoles > 0 ? round1((puttTotal / puttHoles) * 18) : null;

	return {
		rounds: rounds.length,
		avgScore: mean(18, (r) => r.strokes),
		avgVsPar: mean(18, (r) => r.vsPar),
		avgScore9: mean(9, (r) => r.strokes),
		avgVsPar9: mean(9, (r) => r.vsPar),
		puttsPer18,
		firPct: ratio(
			rounds.reduce((t, r) => t + r.owner.firMade, 0),
			rounds.reduce((t, r) => t + r.owner.firEligible, 0),
		),
		girPct: ratio(
			rounds.reduce((t, r) => t + r.owner.girMade, 0),
			rounds.reduce((t, r) => t + r.owner.girHoles, 0),
		),
	};
}
