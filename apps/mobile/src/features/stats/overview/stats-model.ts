import { SCORE_MARKS, type ScoreMark } from "@fairway/core/scoring";
import { type ClubDistance, clubDistances } from "@fairway/core/shots";

/** Each bucket's count and its share of all scored holes (0–1). */
export function distributionShares(
	counts: Record<ScoreMark, number>,
): { key: ScoreMark; count: number; share: number }[] {
	const total = SCORE_MARKS.reduce((t, k) => t + counts[k], 0);
	return SCORE_MARKS.map((key) => ({
		key,
		count: counts[key],
		share: total > 0 ? counts[key] / total : 0,
	}));
}

interface ClubRow {
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
