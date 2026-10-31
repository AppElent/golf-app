import { haversineMeters, type LatLng } from "./geo";

export interface MarkedShot {
	roundId: string;
	holeIndex: number;
	position: LatLng;
	club?: string;
	markedAt: number;
}

export interface ClubDistance {
	club: string;
	/** Median carry+roll of shots hit with this club, meters. */
	medianMeters: number;
	averageMeters: number;
	longestMeters: number;
	shots: number;
}

/** Shots beyond this are almost certainly a mis-mark (or a new hole). */
const MAX_SHOT_METERS = 350;
/** Short chips/putts say nothing about a club's full distance. */
const MIN_SHOT_METERS = 20;

/**
 * Distance hit with each shot: the gap to the next marked shot on the same
 * round + hole. The last shot of a hole has no measurable result.
 */
export function shotDistances(
	shots: ReadonlyArray<MarkedShot>,
): Array<{ shot: MarkedShot; meters: number }> {
	const groups = new Map<string, MarkedShot[]>();
	for (const shot of shots) {
		const key = `${shot.roundId}:${shot.holeIndex}`;
		const group = groups.get(key) ?? [];
		group.push(shot);
		groups.set(key, group);
	}
	const result: Array<{ shot: MarkedShot; meters: number }> = [];
	for (const group of groups.values()) {
		group.sort((a, b) => a.markedAt - b.markedAt);
		for (let i = 0; i < group.length - 1; i++) {
			result.push({
				shot: group[i],
				meters: haversineMeters(group[i].position, group[i + 1].position),
			});
		}
	}
	return result;
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Learned distance per club from marked shots, longest club first. Shots
 *  without a club, and implausibly short/long ones, are ignored. */
export function clubDistances(
	shots: ReadonlyArray<MarkedShot>,
): ClubDistance[] {
	const byClub = new Map<string, number[]>();
	for (const { shot, meters } of shotDistances(shots)) {
		if (!shot.club) continue;
		if (meters < MIN_SHOT_METERS || meters > MAX_SHOT_METERS) continue;
		const list = byClub.get(shot.club) ?? [];
		list.push(meters);
		byClub.set(shot.club, list);
	}
	return [...byClub.entries()]
		.map(([club, values]) => ({
			club,
			medianMeters: Math.round(median(values)),
			averageMeters: Math.round(
				values.reduce((t, m) => t + m, 0) / values.length,
			),
			longestMeters: Math.round(Math.max(...values)),
			shots: values.length,
		}))
		.sort((a, b) => b.medianMeters - a.medianMeters);
}
