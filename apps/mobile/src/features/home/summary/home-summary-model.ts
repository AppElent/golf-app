import { wouldBeIndex } from "@fairway/core/handicap";

/** Would-be index from history rows (newest first), oldest-first for WHS. */
export function wouldBeFromHistory(
	rounds: ReadonlyArray<{ differential: number | null }>,
): { value: number; count: number } | null {
	const differentials = rounds
		.map((r) => r.differential)
		.filter((d): d is number => d !== null)
		.reverse();
	const value = wouldBeIndex(differentials);
	return value === null
		? null
		: { value, count: Math.min(differentials.length, 20) };
}

/** "+3", "E", "−2" — the minus is a real minus sign for legibility. */
export function vsParLabel(diff: number): string {
	if (diff === 0) return "E";
	return diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`;
}
