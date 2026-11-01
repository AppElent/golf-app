/**
 * The pure part of round setup: which holes the picked loops add up to,
 * whether they can be scored, and each player's playing handicap preview.
 * The server recomputes playing handicaps on start; this is display only.
 */
import { roundPlayingHandicap } from "@fairway/core/handicap";
import { detectLoops, type Loop } from "@fairway/core/loops";

export interface SetupHole {
	ref?: string;
	number: number;
	par?: number;
	strokeIndex?: number;
}

export interface SetupTee {
	slopeRating: number;
	courseRating: number;
}

export function courseLoops(holes: ReadonlyArray<SetupHole>): Loop[] {
	return detectLoops(
		holes.flatMap((h) =>
			h.ref !== undefined ? [{ ref: h.ref, number: h.number }] : [],
		),
	);
}

/** Add a loop pick; at most two picks (18 holes), the same loop twice is fine. */
export function toggleLoopPick(picks: readonly number[], index: number) {
	return picks.length >= 2 ? [index] : [...picks, index];
}

export function selection(
	holes: ReadonlyArray<SetupHole>,
	loops: readonly Loop[],
	picks: readonly number[],
) {
	const holeRefs = picks.flatMap((i) => loops[i]?.refs ?? []);
	const byRef = new Map(holes.map((h) => [h.ref, h]));
	const incomplete = holeRefs.filter((ref) => {
		const h = byRef.get(ref);
		return !h || h.par === undefined || h.strokeIndex === undefined;
	});
	const par = holeRefs.reduce(
		(sum, ref) => sum + (byRef.get(ref)?.par ?? 0),
		0,
	);
	const label = picks.map((i) => loops[i]?.label).join(" + ");
	return { holeRefs, incomplete, par, label };
}

/**
 * "12,4" or "12.4" → 12.4; a plus index "+2,0" → −2.0 (as it is written in
 * NL); blank → undefined (scratch / unknown).
 */
export function parseIndex(raw: string): number | undefined {
	const text = raw.trim().replace(",", ".");
	const n = Number.parseFloat(text.replace(/^\+/, ""));
	if (Number.isNaN(n)) return undefined;
	const value = text.startsWith("+") ? -Math.abs(n) : n;
	if (value < -10 || value > 54) return undefined;
	return Math.round(value * 10) / 10;
}

/** The index as a golfer writes it: "18,4", or "+2,0" for a plus index. */
export function indexText(value: number): string {
	return value < 0 ? `+${Math.abs(value).toFixed(1)}` : value.toFixed(1);
}

export function playingHandicapPreview(
	rawIndex: string,
	tee: SetupTee | undefined,
	par: number,
	holeCount: number,
): number | undefined {
	const index = parseIndex(rawIndex);
	if (index === undefined || !tee || par === 0) return undefined;
	return roundPlayingHandicap(index, tee, par, holeCount);
}
