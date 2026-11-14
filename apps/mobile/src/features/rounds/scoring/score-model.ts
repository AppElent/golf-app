import { type HoleScore, type ScoreUpdate, scoreAt } from "@fairway/core/round";

/** What the sheet edits for one player on one hole. */
export interface ScoreDraft {
	strokes: number;
	putts: number | null;
	fir: boolean | null;
	gir: boolean | null;
	penalties: number;
	/** Picked up: no score on this hole (counts 0 Stableford points). */
	nr: boolean;
	/** The user set GIR (or it was stored): stop deriving it. Not saved. */
	girTouched: boolean;
}

/** An edit from the form. */
export type ScoreDraftPatch = Partial<Omit<ScoreDraft, "girTouched">>;

export function initialDrafts(
	scores: readonly HoleScore[],
	holeIndex: number,
	playerCount: number,
	par: number,
): ScoreDraft[] {
	return Array.from({ length: playerCount }, (_, playerIndex) => {
		const s = scoreAt(scores, holeIndex, playerIndex);
		return {
			strokes: s?.strokes ?? par,
			putts: s?.putts ?? null,
			fir: s?.fir ?? null,
			gir: s?.gir ?? null,
			penalties: s?.penalties ?? 0,
			nr: s?.nr ?? false,
			girTouched: s?.gir != null,
		};
	});
}

/** Birdie, par, bogey, double (never below 1). */
export function quickStrokes(par: number): number[] {
	return [par - 1, par, par + 1, par + 2].filter((n) => n >= 1);
}

/**
 * Green in regulation from strokes and putts: on in par − 2 or fewer.
 * Unknown without putts, and never for a picked-up hole.
 */
export function inferredGir(
	draft: Pick<ScoreDraft, "strokes" | "putts" | "nr">,
	par: number,
): boolean | null {
	if (draft.nr || draft.putts === null) return null;
	return draft.strokes - draft.putts <= par - 2;
}

/**
 * Apply an edit. GIR follows strokes and putts until the user sets it; from
 * then on their choice sticks.
 */
export function editDraft(
	draft: ScoreDraft,
	patch: ScoreDraftPatch,
	par: number,
): ScoreDraft {
	const next = { ...draft, ...patch };
	if ("gir" in patch) return { ...next, girTouched: true };
	return next.girTouched ? next : { ...next, gir: inferredGir(next, par) };
}

/** The fields a draft saves. */
export function draftUpdate({
	girTouched: _,
	...fields
}: ScoreDraft): ScoreUpdate {
	return fields;
}
