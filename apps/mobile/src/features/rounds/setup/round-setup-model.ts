/** Add a loop pick; at most two picks (18 holes), the same loop twice is fine. */
export function toggleLoopPick(picks: readonly number[], index: number) {
	return picks.length >= 2 ? [index] : [...picks, index];
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

/** Up to this many tees the list stays open; more fold to the chosen one. */
export const OPEN_TEE_LIST_MAX = 3;

/**
 * The tee rows to show. A long list folds to the chosen tee, so format and
 * players stay on screen; `expanded` shows them all.
 */
export function visibleTees<T extends { _id: string }>(
	tees: ReadonlyArray<T>,
	selectedId: string | null,
	expanded: boolean,
): { rows: T[]; folded: boolean } {
	if (expanded || tees.length <= OPEN_TEE_LIST_MAX) {
		return { rows: [...tees], folded: false };
	}
	const selected = tees.find((t) => t._id === selectedId) ?? tees[0];
	return { rows: selected ? [selected] : [], folded: true };
}
