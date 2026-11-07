type ParsedCarry = { ok: true; value: number } | { ok: false };

/** Carry in whole metres, 1–400. */
export function parseCarry(text: string): ParsedCarry {
	const trimmed = text.trim();
	if (!/^\d{1,3}$/.test(trimmed)) return { ok: false };
	const value = Number(trimmed);
	return value >= 1 && value <= 400 ? { ok: true, value } : { ok: false };
}
