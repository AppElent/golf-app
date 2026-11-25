import { type HoleScore, holeNets, netRank } from "./round";

/** Points for the first, second and third place on a hole; ties share them. */
const PLACE_POINTS = [4, 2, 0];

/** The six points of a hole: 4·2·0, shared 3·3·0, 4·1·1 or 2·2·2. */
export function sixesPoints(nets: ReadonlyArray<number | null>): number[] {
	const ranks = nets.map(netRank);
	return ranks.map((rank) => {
		const better = ranks.filter((r) => r < rank).length;
		const level = ranks.filter((r) => r === rank).length;
		const shared = PLACE_POINTS.slice(better, better + level);
		return shared.reduce((sum, points) => sum + points, 0) / level;
	});
}

export interface SixesStanding {
	/** Per hole; `null` until all three players have a result. */
	holes: ({ points: number[]; nets: (number | null)[] } | null)[];
	totals: number[];
	played: number;
	toPlay: number;
}

export function sixesStanding(
	holeCount: number,
	scores: ReadonlyArray<HoleScore>,
	received: ReadonlyArray<ReadonlyArray<number>>,
): SixesStanding {
	const totals = received.map(() => 0);
	let played = 0;
	const holes = Array.from({ length: holeCount }, (_, holeIndex) => {
		const nets = holeNets(scores, holeIndex, received);
		if (!nets) return null;
		played++;
		const points = sixesPoints(nets);
		points.forEach((p, player) => {
			totals[player] += p;
		});
		return { points, nets };
	});
	return { holes, totals, played, toPlay: holeCount - played };
}
