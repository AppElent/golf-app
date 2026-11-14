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
	/** The user set GIR: stop deriving it. Not saved. */
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
		const draft = {
			strokes: s?.strokes ?? par,
			putts: s?.putts ?? null,
			fir: s?.fir ?? null,
			// A picked-up hole has no GIR, even in rows saved before that rule.
			gir: s?.nr ? null : (s?.gir ?? null),
			penalties: s?.penalties ?? 0,
			nr: s?.nr ?? false,
		};
		// A stored GIR the rule would also give was (or may as well have been)
		// filled in automatically, so it keeps following a correction. One that
		// disagrees with the rule was set by hand and sticks.
		const girTouched =
			draft.gir !== null && draft.gir !== inferredGir(draft, par);
		return { ...draft, girTouched };
	});
}

/** Birdie, par, bogey, double (never below 1). */
export function quickStrokes(par: number): number[] {
	return [par - 1, par, par + 1, par + 2].filter((n) => n >= 1);
}

/**
 * Green in regulation from strokes and putts: on in par − 2 or fewer.
 * Unknown without putts, with no stroke before the putts, and never for a
 * picked-up hole.
 */
export function inferredGir(
	draft: Pick<ScoreDraft, "strokes" | "putts" | "nr">,
	par: number,
): boolean | null {
	if (draft.nr || draft.putts === null || draft.putts >= draft.strokes) {
		return null;
	}
	return draft.strokes - draft.putts <= par - 2;
}

/**
 * Apply an edit. GIR follows strokes and putts until the user sets it; from
 * then on their choice sticks. Picking up clears GIR, set or not.
 */
export function editDraft(
	draft: ScoreDraft,
	patch: ScoreDraftPatch,
	par: number,
): ScoreDraft {
	const next = { ...draft, ...patch };
	if (next.nr) return { ...next, gir: null, girTouched: false };
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
