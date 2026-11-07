import { countedStrokes, type HoleScore, scoreAt } from "@fairway/core/round";
import {
	formatVsPar,
	nineTotals,
	type ScoreMark,
	scoreMark,
	stablefordTotal,
	totalStrokes,
	vsPar,
} from "@fairway/core/scoring";

export interface CardHole {
	/** Hole number on the course card (10, or "(1)" on a par-3 loop). */
	ref: string;
	par: number;
	strokeIndex: number;
}

interface CardCell {
	strokes: number | null;
	mark: ScoreMark | null;
	nr: boolean;
}

export interface CardPlayerRow {
	cells: CardCell[];
	/** Out / In for 18 holes, one total for 9. */
	nines: number[];
	total: number;
	/** "+3", "E", "−1" over the holes scored so far; null when none are. */
	toPar: string | null;
	points: number;
	scored: number;
}

export function cardRows(
	holes: readonly CardHole[],
	scores: readonly HoleScore[],
	players: readonly { playingHandicap?: number }[],
): CardPlayerRow[] {
	return players.map((player, playerIndex) => {
		const cells = holes.map((hole, holeIndex): CardCell => {
			const s = scoreAt(scores, holeIndex, playerIndex);
			const strokes = countedStrokes(s);
			return {
				strokes,
				mark: scoreMark(hole.par, strokes),
				nr: s?.nr ?? false,
			};
		});
		const strokes = cells.map((c) => c.strokes);
		const scored = cells.filter((c) => c.strokes !== null).length;
		const points = stablefordTotal(holes, strokes, player.playingHandicap ?? 0);
		return {
			cells,
			nines: nineTotals(strokes),
			total: totalStrokes(strokes),
			toPar: scored > 0 ? formatVsPar(vsPar(holes, strokes)) : null,
			points,
			scored,
		};
	});
}
