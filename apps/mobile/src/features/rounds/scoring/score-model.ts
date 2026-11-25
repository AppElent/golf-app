import {
	derivedGir,
	type HoleScore,
	type MissSide,
	OWNER_INDEX,
	type ScoreUpdate,
	scoreAt,
} from "@fairway/core/round";
import { formatVsPar, stablefordPoints } from "@fairway/core/scoring";
import { fmt } from "../../../i18n/core";
import type { Messages } from "../../../i18n/messages/en";

type ScoreCopy = Messages["score"];

/** What the sheet edits for one player on one hole. Only the owner has stats. */
export interface ScoreDraft {
	/** null: no score yet (another player). The owner starts at par. */
	strokes: number | null;
	putts: number | null;
	fir: boolean | null;
	firMiss: MissSide | null;
	bunker: boolean;
	penalties: number;
	/** Picked up: no score on this hole (counts 0 Stableford points). */
	nr: boolean;
}

export type ScoreDraftPatch = Partial<ScoreDraft>;

export function initialDrafts(
	scores: readonly HoleScore[],
	holeIndex: number,
	playerCount: number,
	par: number,
): ScoreDraft[] {
	return Array.from({ length: playerCount }, (_, playerIndex) => {
		const s = scoreAt(scores, holeIndex, playerIndex);
		return {
			strokes: s?.strokes ?? (playerIndex === OWNER_INDEX ? par : null),
			putts: s?.putts ?? null,
			fir: s?.fir ?? null,
			firMiss: s?.firMiss ?? null,
			bunker: s?.bunker ?? false,
			penalties: s?.penalties ?? 0,
			nr: s?.nr ?? false,
		};
	});
}

/** One tap for the owner: birdie to triple (never below 1). */
export const ownerQuickStrokes = (par: number) => strokesFrom(par, 3);

/** One tap for another player: birdie to double (never below 1). */
export const flightQuickStrokes = (par: number) => strokesFrom(par, 2);

function strokesFrom(par: number, over: number): number[] {
	return Array.from({ length: over + 2 }, (_, i) => par - 1 + i).filter(
		(n) => n >= 1,
	);
}

/** A result the one-tap buttons don't offer, so the ⋯ button shows it. */
export function isOtherResult(draft: ScoreDraft, par: number): boolean {
	return (
		draft.nr ||
		(draft.strokes !== null && !flightQuickStrokes(par).includes(draft.strokes))
	);
}

/**
 * Step another player's score from ⋯: the first step leaves the buttons, or
 * brings back the score a picked-up player had.
 */
export function stepOther(
	{ strokes, nr }: Pick<ScoreDraft, "strokes" | "nr">,
	par: number,
	by: 1 | -1,
): number {
	if (nr && strokes !== null) return strokes;
	const from = strokes ?? (by > 0 ? par + 2 : par - 1);
	return Math.max(1, from + by);
}

export type TeeShot = MissSide | "fairway";

/** null: not recorded, or an older score that missed without a side. */
export function teeShotOf({
	fir,
	firMiss,
}: Pick<ScoreDraft, "fir" | "firMiss">): TeeShot | null {
	if (fir) return "fairway";
	return fir === false ? firMiss : null;
}

/** Tap a band; tapping the selected one again clears it. */
export function pickTeeShot(
	draft: ScoreDraft,
	shot: TeeShot,
): Pick<ScoreDraft, "fir" | "firMiss"> {
	if (teeShotOf(draft) === shot) return { fir: null, firMiss: null };
	return shot === "fairway"
		? { fir: true, firMiss: null }
		: { fir: false, firMiss: shot };
}

/**
 * The fields a draft saves; null when there is nothing to save. A player who
 * is already stored always saves, so undoing a pick-up is not lost. GIR is
 * derived once putts are known and cleared on a picked-up hole. Without putts
 * it is left out, which keeps what an older build stored by hand.
 */
export function draftUpdate(
	draft: ScoreDraft,
	{ par, owner, stored }: { par: number; owner: boolean; stored: boolean },
): ScoreUpdate | null {
	const { strokes, nr, ...stats } = draft;
	if (strokes === null && !nr && !stored) return null;
	const result = { ...(strokes === null ? {} : { strokes }), nr };
	if (!owner) return result;
	const gir = derivedGir(par, draft);
	return {
		...result,
		...stats,
		...(nr || stats.putts !== null ? { gir } : {}),
	};
}

/** "Bogey · +1"; Stableford adds points instead: "Double bogey · 1 pt". */
export function resultBadge({
	draft,
	par,
	received,
	stableford,
	copy,
}: {
	draft: ScoreDraft;
	par: number;
	received: number;
	stableford: boolean;
	copy: ScoreCopy;
}): string {
	const strokes = draft.nr ? null : draft.strokes;
	const points = stableford
		? fmt(copy.points, { n: stablefordPoints({ par }, strokes, received) })
		: null;
	if (strokes === null) {
		return [copy.pickedUp, points].filter(Boolean).join(" · ");
	}
	const toPar = strokes - par;
	const name = resultName(toPar, copy);
	const diff = formatVsPar(toPar);
	// "Par · E" says the same thing twice, and "+4" has no name.
	return [name ?? diff, points ?? (name && toPar !== 0 ? diff : null)]
		.filter(Boolean)
		.join(" · ");
}

function resultName(toPar: number, copy: ScoreCopy): string | null {
	if (toPar <= -3) return copy.results.albatross;
	const names: Record<number, string> = {
		[-2]: copy.results.eagle,
		[-1]: copy.results.birdie,
		0: copy.results.par,
		1: copy.results.bogey,
		2: copy.results.double,
		3: copy.results.triple,
	};
	return names[toPar] ?? null;
}

/** "+1 stroke · net 4"; Stableford "+1 stroke · 2 pt"; what is known so far. */
export function flightDetail({
	draft,
	par,
	received,
	stableford,
	copy,
	strokesLabel,
}: {
	draft: ScoreDraft;
	par: number;
	received: number;
	stableford: boolean;
	copy: ScoreCopy;
	/** "+1 stroke", in the locale's plural. */
	strokesLabel: string;
}): string {
	const strokes = draft.nr ? null : draft.strokes;
	const scored = draft.nr || strokes !== null;
	let result: string | null = null;
	if (scored && stableford) {
		result = fmt(copy.points, {
			n: stablefordPoints({ par }, strokes, received),
		});
	} else if (draft.nr) {
		result = copy.pickedUp;
	} else if (strokes !== null && received !== 0) {
		result = fmt(copy.net, { n: strokes - received });
	}
	return [received === 0 ? null : strokesLabel, result]
		.filter(Boolean)
		.join(" · ");
}
