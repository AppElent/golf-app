import { formatVsPar } from "@fairway/core/scoring";
import { useI18n } from "../../../i18n";
import { type GameRound, gameText } from "./game-text";

type Round = Pick<
	GameRound,
	"format" | "formatOptions" | "teams" | "players" | "startHoleIndex"
>;

/** The game of a round in the reader's language. */
export function useGame() {
	const { t, locale } = useI18n();
	return (
		round: Round,
		holes: GameRound["holes"],
		scores: GameRound["scores"],
	) => gameText({ ...round, holes, scores }, { t, locale, vsPar: formatVsPar });
}
