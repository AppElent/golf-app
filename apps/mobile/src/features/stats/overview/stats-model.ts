/**
 * Stats from Convex reads: the would-be trend, pooled averages, per-par
 * averages, the scoring distribution and learned club distances. Pure, so the
 * screen only lays numbers out.
 */
import { wouldBeIndexHistory } from "@fairway/core/handicap";
import { type ClubDistance, clubDistances } from "@fairway/core/shots";
import type { RoundStatInput } from "@fairway/core/stats";

export interface HistoryRow {
	differential: number | null;
	holeCount: number;
	owner: Omit<RoundStatInput, "holeCount">;
}

/** History rows (newest first) as `aggregateStats` input. */
export function statInputs(rounds: readonly HistoryRow[]): RoundStatInput[] {
	return rounds.map((r) => ({ holeCount: r.holeCount, ...r.owner }));
}

/** Would-be index after each round, oldest first (for the sparkline). */
export function wouldBeTrend(rounds: readonly HistoryRow[]): number[] {
	const differentials = rounds
		.map((r) => r.differential)
		.filter((d): d is number => d !== null)
		.reverse();
	return wouldBeIndexHistory(differentials);
}

export type DistributionKey =
	| "eagles"
	| "birdies"
	| "pars"
	| "bogeys"
	| "doubles";

/** Each bucket's count and its share of all scored holes (0–1). */
export function distributionShares(
	counts: Record<DistributionKey, number>,
): { key: DistributionKey; count: number; share: number }[] {
	const keys: DistributionKey[] = [
		"eagles",
		"birdies",
		"pars",
		"bogeys",
		"doubles",
	];
	const total = keys.reduce((t, k) => t + counts[k], 0);
	return keys.map((key) => ({
		key,
		count: counts[key],
		share: total > 0 ? counts[key] / total : 0,
	}));
}

export interface ClubRow {
	name: string;
	/** Carry from the bag, if the club is in it. */
	carryMeters: number | null;
	learned: ClubDistance | null;
}

/**
 * The bag in its own order with each club's learned distance, then clubs only
 * seen in marked shots (renamed or removed from the bag) after it.
 */
export function clubRows(
	bag: readonly { name: string; carryMeters: number }[],
	shots: readonly {
		roundId: string;
		holeIndex: number;
		position: { lat: number; lng: number };
		club?: string;
		markedAt: number;
	}[],
): ClubRow[] {
	const learned = new Map(clubDistances(shots).map((d) => [d.club, d]));
	const rows: ClubRow[] = bag.map((club) => ({
		name: club.name,
		carryMeters: club.carryMeters,
		learned: learned.get(club.name) ?? null,
	}));
	for (const [name, distance] of learned) {
		if (!bag.some((c) => c.name === name)) {
			rows.push({ name, carryMeters: null, learned: distance });
		}
	}
	return rows;
}
