import type { RoundFormat } from "@fairway/core/round";
import { countsForPlayer } from "@fairway/core/round-formats";
import { formatVsPar } from "@fairway/core/scoring";
import type { Messages } from "../../../i18n/messages/en";

/** A team round's score is not one player's, so its row names the format. */
export function teamRoundName(
	{ format }: { format: RoundFormat },
	t: Pick<Messages, "setup">,
): string | null {
	return countsForPlayer(format) ? null : t.setup.formats[format].title;
}

/** "84 (+12)"; undefined for a round with no strokes recorded. */
export function scoreLabel(owner: {
	strokes: number;
	vsPar: number;
}): string | undefined {
	return owner.strokes > 0
		? `${owner.strokes} (${formatVsPar(owner.vsPar)})`
		: undefined;
}
