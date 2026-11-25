import { type HoleScore, holeNets, netRank } from "./round";

export interface MatchHole {
	/** Player who won the hole, `null` when halved. */
	winner: 0 | 1 | null;
	nets: (number | null)[];
	/** Holes player 0 is up after this hole; negative when player 1 leads. */
	lead: number;
}

export interface MatchResult {
	winner: 0 | 1;
	/** Holes up when it was decided. */
	up: number;
	/** Holes that were left; 0 means "2 up" instead of "3&2". */
	left: number;
	holeIndex: number;
}

export interface MatchStanding {
	/** Per hole; `null` until both players have a result. */
	holes: (MatchHole | null)[];
	played: number;
	/** Holes to play in the match, 0 once it is decided. */
	toPlay: number;
	/** Standing when decided, or after the last scored hole. */
	lead: number;
	leader: 0 | 1 | null;
	up: number;
	dormie: boolean;
	result: MatchResult | null;
	/** All square after the last hole. */
	halved: boolean;
}

/**
 * A match over the holes both players have a result on, in hole order. Holes
 * played out after the match is decided keep no influence on it.
 */
export function matchStanding(
	holeCount: number,
	scores: ReadonlyArray<HoleScore>,
	received: ReadonlyArray<ReadonlyArray<number>>,
): MatchStanding {
	let lead = 0;
	let played = 0;
	let result: MatchResult | null = null;
	const holes = Array.from({ length: holeCount }, (_, holeIndex) => {
		const nets = holeNets(scores, holeIndex, received);
		if (!nets) return null;
		const [a, b] = nets.map(netRank);
		const winner = a === b ? null : a < b ? (0 as const) : (1 as const);
		if (!result) {
			played++;
			if (winner !== null) lead += winner === 0 ? 1 : -1;
			const left = holeCount - played;
			if (Math.abs(lead) > left) {
				result = {
					winner: lead > 0 ? 0 : 1,
					up: Math.abs(lead),
					left,
					holeIndex,
				};
			}
		}
		return { winner, nets, lead };
	});
	const toPlay = result ? 0 : holeCount - played;
	const up = Math.abs(lead);
	return {
		holes,
		played,
		toPlay,
		lead,
		leader: lead === 0 ? null : lead > 0 ? 0 : 1,
		up,
		dormie: !result && up > 0 && up === toPlay,
		result,
		halved: holeCount > 0 && !result && toPlay === 0,
	};
}
