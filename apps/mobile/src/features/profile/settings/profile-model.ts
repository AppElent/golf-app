/**
 * Parsing what golfers type: a handicap index the way it is printed on a
 * card ("18,4", "18.4", "+1.2" for a plus handicap) and a club's carry.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false };

/**
 * A WHS index, one decimal. Empty clears it (null). A leading "+" is a plus
 * handicap, stored negative as WHS does.
 */
export function parseHandicap(text: string): Parsed<number | null> {
	const trimmed = text.trim().replace(",", ".");
	if (trimmed === "") return { ok: true, value: null };
	if (!/^[+-]?\d{1,2}(\.\d)?$/.test(trimmed)) return { ok: false };
	const magnitude = Number(trimmed.replace(/^[+-]/, ""));
	const value = trimmed.startsWith("+") ? -magnitude : Number(trimmed);
	if (value < -10 || value > 54) return { ok: false };
	return { ok: true, value: value === 0 ? 0 : value };
}

/** A handicap as it is written: "18.4", "+1.2" for a plus index. */
export function handicapText(value: number | null): string {
	if (value === null) return "";
	return value < 0 ? `+${Math.abs(value).toFixed(1)}` : value.toFixed(1);
}

/** Carry in whole metres, 1–400. */
export function parseCarry(text: string): Parsed<number> {
	const trimmed = text.trim();
	if (!/^\d{1,3}$/.test(trimmed)) return { ok: false };
	const value = Number(trimmed);
	return value >= 1 && value <= 400 ? { ok: true, value } : { ok: false };
}
