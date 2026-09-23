export interface Loop {
	label: string;
	refs: string[];
}

interface HoleRef {
	ref: string;
	number: number;
}

const isParenthesized = (ref: string): boolean => ref.startsWith("(");

/**
 * Group a course's holes into playable loops from their OSM refs:
 * plain refs are split into 1–9 and 10–18 bands; parenthesized refs
 * ("(1)"…"(9)", a third loop at both home courses) form their own loop.
 * Refs are ordered numerically within each loop.
 */
export function detectLoops(holes: ReadonlyArray<HoleRef>): Loop[] {
	const buckets = new Map<string, HoleRef[]>();
	for (const hole of holes) {
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
