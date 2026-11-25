import type { RoundFormat } from "@fairway/core/round";

/** A round has the owner and at most three guests. */
export const MAX_PLAYERS = 4;

/** The formats a round can start in, in the order their tiles are drawn. */
export const FORMAT_TILES: readonly RoundFormat[] = ["stableford", "stroke"];

/**
 * A tap on a loop's tile. At most two picks (18 holes): a picked loop is played
 * twice, then not at all; another loop joins a single pick, else starts over.
 */
export function toggleLoopPick(
	picks: readonly number[],
	index: number,
): number[] {
	const count = picks.filter((pick) => pick === index).length;
	if (count === 2) return [];
	if (count === 1) return [index, index];
	return picks.length >= 2 ? [index] : [...picks, index];
}

/** The loop played twice, or null when every pick is a different loop. */
export function doubledLoop(picks: readonly number[]): number | null {
	return picks.length === 2 && picks[0] === picks[1] ? picks[0] : null;
}

/** The letter in a player's avatar. */
export function playerInitial(name: string): string {
	return (Array.from(name.trim())[0] ?? "").toUpperCase();
}

/** A playing handicap as it is read: 14, or "+2" for a plus player's -2. */
export function playingHandicapText(value: number): string {
	return value < 0 ? `+${-value}` : String(value);
}

/** The tee last played on this course, else the course's first tee. */
export function defaultTeeId<Id extends string>(
	tees: ReadonlyArray<{ _id: Id }>,
	lastTeeId: Id | null | undefined,
): Id | null {
	if (lastTeeId && tees.some((t) => t._id === lastTeeId)) return lastTeeId;
	return tees[0]?._id ?? null;
}

interface LengthHole {
	ref?: string;
	lengthMeters?: number;
	lengths?: Record<string, number>;
}

/**
 * The selected holes' length from this tee, in meters: each hole's length for
 * the tee's marker, else its general length. `null` when any hole has none, so
 * a partial sum never passes for the course length.
 */
export function teeLengthMeters(
	tee: { marker?: string },
	holes: ReadonlyArray<LengthHole>,
	holeRefs: ReadonlyArray<string>,
): number | null {
	if (holeRefs.length === 0) return null;
	const byRef = new Map(holes.map((h) => [h.ref, h]));
	let total = 0;
	for (const ref of holeRefs) {
		const hole = byRef.get(ref);
		const length =
			(tee.marker ? hole?.lengths?.[tee.marker] : undefined) ??
			hole?.lengthMeters;
		if (length === undefined) return null;
		total += length;
	}
	return total;
}
