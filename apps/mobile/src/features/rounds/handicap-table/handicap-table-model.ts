import { type FormatRound, sideHandicaps } from "@fairway/core/round-formats";
import type { Messages } from "../../../i18n/messages/en";
import { type GameRound, gameSides } from "../formats/game-text";

export type TableRound = Pick<FormatRound, "format" | "formatOptions"> &
	Pick<GameRound, "teams" | "players">;

/**
 * The table's columns: the sides of the game with the handicap it is played
 * off. A player without one keeps the dash, unless the game gives them strokes.
 */
export function tablePlayers(
	round: TableRound,
	copy: Messages["formats"],
): { name: string; playingHandicap?: number }[] {
	const handicaps = sideHandicaps(round);
	const teams = round.format === "scramble";
	return gameSides(round, copy).map(({ name }, side) => ({
		name,
		playingHandicap:
			!teams && round.players[side].playingHandicap === undefined
				? handicaps[side] || undefined
				: handicaps[side],
	}));
}
