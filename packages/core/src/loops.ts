export interface Loop {
	label: string;
	refs: string[];
}

interface HoleRef {
	ref: string;
	number: number;
}

/** A course's hole row, as far as setting up a round is concerned. */
export interface SetupHole {
	ref?: string;
	number: number;
	par?: number;
	strokeIndex?: number;
}

const isParenthesized = (ref: string): boolean => ref.startsWith("(");

/**
 * Group a course's holes into playable loops from their OSM refs:
 * plain refs are split into 1–9 and 10–18 bands; parenthesized refs
 * ("(1)"…"(9)", a third loop at both home courses) form their own loop.
 * Refs are ordered numerically within each loop. Holes without a ref can't be
 * played and belong to no loop.
 */
export function detectLoops(holes: ReadonlyArray<SetupHole>): Loop[] {
	const buckets = new Map<string, HoleRef[]>();
	for (const { ref, number } of holes) {
		if (ref === undefined) continue;
		const hole = { ref, number };
		const key = isParenthesized(hole.ref)
			? "paren"
			: hole.number <= 9
				? "front"
				: "back";
		const bucket = buckets.get(key) ?? [];
		bucket.push(hole);
		buckets.set(key, bucket);
	}

	const loops: Loop[] = [];
	for (const key of ["front", "back", "paren"] as const) {
		const bucket = buckets.get(key);
		if (!bucket || bucket.length === 0) continue;
		const sorted = [...bucket].sort((a, b) => a.number - b.number);
		const first = sorted[0];
		const last = sorted[sorted.length - 1];
		loops.push({
			label: `${first.ref}–${last.ref}`,
			refs: sorted.map((h) => h.ref),
		});
	}
	return loops;
}

/**
 * The par of the given holes, and those that can't be scored because the
 * course is missing them or their par or stroke index.
 */
export function checkHoleRefs(
	holeRefs: ReadonlyArray<string>,
	holes: ReadonlyArray<SetupHole>,
): { par: number; incomplete: string[] } {
	const byRef = new Map(holes.map((h) => [h.ref, h]));
	const incomplete = holeRefs.filter((ref) => {
		const h = byRef.get(ref);
		return !h || h.par === undefined || h.strokeIndex === undefined;
	});
	const par = holeRefs.reduce(
		(sum, ref) => sum + (byRef.get(ref)?.par ?? 0),
		0,
	);
	return { par, incomplete };
}

/** What the picked loops add up to; a loop may be picked twice. */
export function selectLoops(
	holes: ReadonlyArray<SetupHole>,
	loops: ReadonlyArray<Loop>,
	picks: ReadonlyArray<number>,
) {
	const holeRefs = picks.flatMap((i) => loops[i]?.refs ?? []);
	const label = picks.map((i) => loops[i]?.label).join(" + ");
	return { holeRefs, label, ...checkHoleRefs(holeRefs, holes) };
}
