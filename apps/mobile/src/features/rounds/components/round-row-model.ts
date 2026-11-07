import { formatVsPar } from "@fairway/core/scoring";

/** "84 (+12)"; undefined for a round with no strokes recorded. */
export function scoreLabel(owner: {
	strokes: number;
	vsPar: number;
}): string | undefined {
	return owner.strokes > 0
		? `${owner.strokes} (${formatVsPar(owner.vsPar)})`
		: undefined;
}
