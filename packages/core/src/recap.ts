/**
 * The post-round recap: how a round went, in the terms a golfer retells it —
 * how many birdies and pars, the net score against the playing handicap, the
 * best and the toughest hole, and the two nines.
 */
import {
	nineRanges,
	type ScoreMark,
	scoreMark,
	strokesPerHole,
	totalStrokes,
} from "./scoring";

export interface RecapHole {
	par: number;
	strokeIndex: number;
}

export interface RoundRecap {
	/** Holes with a score (picked-up holes excluded). */
	scored: number;
	marks: Record<ScoreMark, number>;
	/** Gross minus playing handicap; null unless every hole is scored. */
	net: number | null;
	/** Net to par; null with `net`. */
	netToPar: number | null;
	/** Lowest score to par (earliest on a tie); null when nothing is scored. */
	best: { holeIndex: number; toPar: number } | null;
	/** Highest score to par against the strokes received (the hole that
	 *  cost most net), when it is worse than a net par. */
	toughest: { holeIndex: number; toPar: number } | null;
	/** Strokes and to-par per nine (one entry for a 9-hole round), over the
	 *  scored holes of that nine. */
	nines: { strokes: number; toPar: number; complete: boolean }[];
}

export function roundRecap(
	holes: readonly RecapHole[],
	strokes: readonly (number | null)[],
	playingHandicap: number | undefined,
): RoundRecap {
	const marks: Record<ScoreMark, number> = {
		eagle: 0,
		birdie: 0,
		par: 0,
		bogey: 0,
		double: 0,
	};
	const received = strokesPerHole(holes, playingHandicap ?? 0);
	let best: RoundRecap["best"] = null;
	let toughest: (RoundRecap["toughest"] & { net: number }) | null = null;
	let scored = 0;
	holes.forEach((hole, i) => {
		const s = strokes[i] ?? null;
		const mark = scoreMark(hole.par, s);
		if (s === null || mark === null) return;
		scored++;
		marks[mark]++;
		const toPar = s - hole.par;
		if (!best || toPar < best.toPar) best = { holeIndex: i, toPar };
		const net = toPar - (received[i] ?? 0);
		if (net > 0 && (!toughest || net > toughest.net))
			toughest = { holeIndex: i, toPar, net };
	});
	const gross = totalStrokes(strokes);
	const par = holes.reduce((t, h) => t + h.par, 0);
	const complete =
		holes.length > 0 &&
		strokes.length >= holes.length &&
		scored === holes.length;
	const net =
		complete && playingHandicap !== undefined ? gross - playingHandicap : null;
	const nines = nineRanges(holes.length).map(({ from, to }) => {
		let sum = 0;
		let toPar = 0;
		let done = 0;
		for (let i = from; i < to; i++) {
			const s = strokes[i] ?? null;
			if (s === null) continue;
			sum += s;
			toPar += s - (holes[i]?.par ?? 0);
			done++;
		}
		return { strokes: sum, toPar, complete: done === to - from };
	});
	const worst = toughest as (RoundRecap["toughest"] & { net: number }) | null;
	return {
		scored,
		marks,
		net,
		netToPar: net === null ? null : net - par,
		best,
		toughest: worst ? { holeIndex: worst.holeIndex, toPar: worst.toPar } : null,
		nines,
	};
}
