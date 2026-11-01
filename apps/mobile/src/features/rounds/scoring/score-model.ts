/**
 * The arithmetic behind the score sheet and the scorecard, kept out of the
 * screens so it can be tested: what the sheet starts from, which quick picks
 * it offers, and the Out / In / Total each card row shows.
 */
import {
	formatVsPar,
	type ScoreMark,
	scoreMark,
	stablefordTotal,
	vsPar,
} from "@fairway/core/scoring";

/** One stored result (a `holeScores` row, minus the ids). */
export interface StoredScore {
	holeIndex: number;
	playerIndex: number;
	strokes?: number;
	putts?: number;
	fir?: boolean;
	gir?: boolean;
	penalties?: number;
	nr?: boolean;
}

/** What the sheet edits for one player on one hole. */
export interface ScoreDraft {
	strokes: number;
	putts: number | null;
	fir: boolean | null;
	gir: boolean | null;
	penalties: number;
	/** Picked up: no score on this hole (counts 0 Stableford points). */
	nr: boolean;
}

export interface CardHole {
	/** Hole number on the course card (10, or "(1)" on a par-3 loop). */
	ref?: string;
	par: number;
	strokeIndex: number;
}

/**
 * The sheet's starting point for each player: what is stored, or par for a
 * hole not yet scored (the most likely result and one tap from any other).
 */
export function initialDrafts(
	scores: readonly StoredScore[],
	holeIndex: number,
	playerCount: number,
	par: number,
): ScoreDraft[] {
	return Array.from({ length: playerCount }, (_, playerIndex) => {
		const s = scores.find(
			(x) => x.holeIndex === holeIndex && x.playerIndex === playerIndex,
		);
		return {
			strokes: s?.strokes ?? par,
			putts: s?.putts ?? null,
			fir: s?.fir ?? null,
			gir: s?.gir ?? null,
			penalties: s?.penalties ?? 0,
			nr: s?.nr ?? false,
		};
	});
}

/** Quick picks around par: birdie, par, bogey, double (never below 1). */
export function quickStrokes(par: number): number[] {
	return [par - 1, par, par + 1, par + 2].filter((n) => n >= 1);
}

/** Fairway hit only means something off a par-4 or par-5 tee. */
export const tracksFairway = (par: number) => par >= 4;

/** The mutation payload for one player's draft. */
export function draftToScore(draft: ScoreDraft) {
	return {
		strokes: draft.strokes,
		// null clears a value saved earlier (undefined would keep it).
		putts: draft.putts,
		fir: draft.fir,
		gir: draft.gir,
		penalties: draft.penalties,
		nr: draft.nr,
	};
}

export interface CardCell {
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

/** One scorecard row per player. NR holes show as a dash and score nothing. */
export function cardRows(
	holes: readonly CardHole[],
	scores: readonly StoredScore[],
	players: readonly { playingHandicap?: number }[],
): CardPlayerRow[] {
	return players.map((player, playerIndex) => {
		const cells = holes.map((hole, holeIndex): CardCell => {
			const s = scores.find(
				(x) => x.holeIndex === holeIndex && x.playerIndex === playerIndex,
			);
			const nr = s?.nr ?? false;
			const strokes = nr ? null : (s?.strokes ?? null);
			return { strokes, mark: scoreMark(hole.par, strokes), nr };
		});
		const strokes = cells.map((c) => c.strokes);
		const sum = (from: number, to: number) =>
			strokes.slice(from, to).reduce<number>((t, s) => t + (s ?? 0), 0);
		const nines =
			holes.length > 9 ? [sum(0, 9), sum(9, holes.length)] : [sum(0, 9)];
		const scored = cells.filter((c) => c.strokes !== null).length;
		const points = stablefordTotal(holes, strokes, player.playingHandicap ?? 0);
		return {
			cells,
			nines,
			total: sum(0, holes.length),
			toPar: scored > 0 ? formatVsPar(vsPar(holes, strokes)) : null,
			points,
			scored,
		};
	});
}

/** Holes the owner (player 0) has no result for — warned about on finish. */
export function unscoredHoles(
	holeCount: number,
	scores: readonly StoredScore[],
): number[] {
	const done = new Set(
		scores
			.filter((s) => s.playerIndex === 0 && (s.strokes !== undefined || s.nr))
			.map((s) => s.holeIndex),
	);
	return Array.from({ length: holeCount }, (_, i) => i).filter(
		(i) => !done.has(i),
	);
}
