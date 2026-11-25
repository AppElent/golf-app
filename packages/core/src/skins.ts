import { type HoleScore, holeNets, netRank } from "./round";

export interface SkinsHole {
	/** Player who won alone, `null` when tied (or everyone picked up). */
	winner: number | null;
	/** Skins the hole was worth, carried ones included. */
	value: number;
	nets: (number | null)[];
	/** Players sharing the best net score on a tied hole; empty if all picked up. */
	tied: number[];
}

export interface SkinsStanding {
	/** Per hole; `null` until every player has a result. */
	holes: (SkinsHole | null)[];
	/** Skins won per player. */
	won: number[];
	/** Skins carried to the next hole, or left on the table after the last. */
	carried: number;
	/** The tied holes those carried skins come from. */
	carriedFrom: number[];
	played: number;
	toPlay: number;
}

/**
 * Skins over the holes every player has a result on, in hole order. A skin goes
 * to the only lowest net; a tied skin carries to the next hole, or is gone.
 */
export function skinsStanding(
	holeCount: number,
	scores: ReadonlyArray<HoleScore>,
	received: ReadonlyArray<ReadonlyArray<number>>,
	carryOver: boolean,
): SkinsStanding {
	const won = received.map(() => 0);
	let carriedFrom: number[] = [];
	let played = 0;
	const holes = Array.from({ length: holeCount }, (_, holeIndex) => {
		const nets = holeNets(scores, holeIndex, received);
		if (!nets) return null;
		played++;
		const value = 1 + carriedFrom.length;
		const best = Math.min(...nets.map(netRank));
		const tied =
			best === Infinity
				? []
				: nets.flatMap((net, player) => (net === best ? [player] : []));
		if (tied.length === 1) {
			won[tied[0]] += value;
			carriedFrom = [];
			return { winner: tied[0], value, nets, tied: [] };
		}
		if (carryOver) carriedFrom = [...carriedFrom, holeIndex];
		return { winner: null, value, nets, tied };
	});
	return {
		holes,
		won,
		carried: carriedFrom.length,
		carriedFrom,
		played,
		toPlay: holeCount - played,
	};
}

/** What the skin on a hole is worth, from the holes before it. */
export function skinValue(
	holeIndex: number,
	holeCount: number,
	scores: ReadonlyArray<HoleScore>,
	received: ReadonlyArray<ReadonlyArray<number>>,
	carryOver: boolean,
): { value: number; carriedFrom: number[] } {
	const { carriedFrom } = skinsStanding(
		holeCount,
		scores.filter((s) => s.holeIndex < holeIndex),
		received,
		carryOver,
	);
	return { value: 1 + carriedFrom.length, carriedFrom };
}
