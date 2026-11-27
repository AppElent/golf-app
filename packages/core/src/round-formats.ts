/**
 * What every round format shares: who can play it, who gets strokes where, and
 * which side (player, or scramble team) a stored score belongs to. The games
 * themselves are derived in match-play, skins, sixes and scramble.
 */
import { type MatchStanding, matchStanding } from "./match-play";
import {
	type FormatOptions,
	type HoleScore,
	hasResult,
	OWNER_INDEX,
	playingOrder,
	type RecordedScore,
	type RoundFormat,
	type RoundTeam,
	scoreAt,
} from "./round";
import { strokesPerHole } from "./scoring";
import {
	type ScrambleStanding,
	scrambleStanding,
	teamHandicaps,
} from "./scramble";
import { type SixesStanding, sixesStanding } from "./sixes";
import { type SkinsStanding, skinsStanding } from "./skins";

/** How many players each format takes; no `max` means as many as a round has. */
export const FORMAT_PLAYERS: Record<
	RoundFormat,
	{ min: number; max?: number }
> = {
	stableford: { min: 1 },
	stroke: { min: 1 },
	match: { min: 2, max: 2 },
	skins: { min: 2, max: 4 },
	sixes: { min: 3, max: 3 },
	scramble: { min: 2, max: 4 },
};

export function formatFits(format: RoundFormat, playerCount: number): boolean {
	// A newer app can store a format this build doesn't know.
	const range: { min: number; max?: number } | undefined =
		FORMAT_PLAYERS[format];
	if (!range) return false;
	const { min, max } = range;
	return playerCount >= min && (max === undefined || playerCount <= max);
}

/** Formats with a net/gross choice of their own. */
export function hasFormatOptions(format: RoundFormat): boolean {
	return format !== "stroke" && format !== "stableford";
}

/** A scramble is a team score: it says nothing about one player's game. */
export function countsForPlayer(format: RoundFormat): boolean {
	return format !== "scramble";
}

export function isNet(options: FormatOptions | undefined): boolean {
	return options?.scoring !== "gross";
}

export function carriesOver(options: FormatOptions | undefined): boolean {
	return options?.carryOver !== false;
}

const MIN_TEAM_SIZE = 2;

/** One or two teams of at least two, every player in exactly one, the owner in team 0. */
export function validTeams(
	teams: readonly RoundTeam[],
	playerCount: number,
): boolean {
	if (teams.length < 1 || teams.length > 2) return false;
	if (teams.some((t) => t.playerIndexes.length < MIN_TEAM_SIZE)) return false;
	if (!teams[0].playerIndexes.includes(OWNER_INDEX)) return false;
	const members = teams.flatMap((t) => t.playerIndexes).sort((a, b) => a - b);
	return (
		members.length === playerCount &&
		members.every((member, index) => member === index)
	);
}

export interface FormatRound {
	format: RoundFormat;
	formatOptions?: FormatOptions;
	teams?: readonly RoundTeam[];
	players: ReadonlyArray<{ playingHandicap?: number }>;
	/** The hole the round began on; absent, the order is inferred. */
	startHoleIndex?: number;
}

/** How many scores a hole takes: one per player, one per team in a scramble. */
export function sideCount(round: FormatRound): number {
	return round.format === "scramble"
		? (round.teams?.length ?? 1)
		: round.players.length;
}

/**
 * The scores a round's total counts: between two scramble teams only those on
 * holes every team has a result on, like the winner.
 */
export function comparedScores<S extends HoleScore>(
	round: FormatRound,
	scores: readonly S[],
): readonly S[] {
	const sides = sideCount(round);
	if (round.format !== "scramble" || sides < 2) return scores;
	return scores.filter(({ holeIndex }) =>
		Array.from({ length: sides }, (_, side) =>
			hasResult(scoreAt(scores, holeIndex, side)),
		).every(Boolean),
	);
}

/**
 * The handicap each side plays the format off. A player without one plays
 * gross. In a net match only the difference counts: the lower plays off 0.
 */
export function sideHandicaps(round: FormatRound): number[] {
	const own = round.players.map((p) => p.playingHandicap ?? 0);
	if (hasFormatOptions(round.format) && !isNet(round.formatOptions)) {
		return Array.from({ length: sideCount(round) }, () => 0);
	}
	if (round.format === "match") {
		const lowest = Math.min(...own);
		return own.map((handicap) => handicap - lowest);
	}
	if (round.format === "scramble") return teamHandicaps(round.teams ?? [], own);
	return own;
}

/** Strokes each side gets on each hole: `[side][hole]`. */
export function sideStrokes(
	round: FormatRound,
	holes: ReadonlyArray<{ strokeIndex: number }>,
): number[][] {
	return sideHandicaps(round).map((handicap) =>
		strokesPerHole(holes, handicap),
	);
}

export interface ScoredFormatRound extends FormatRound {
	holes: ReadonlyArray<{ par: number; strokeIndex: number }>;
	scores: ReadonlyArray<RecordedScore>;
}

export type FormatStanding =
	| ({ kind: "match" } & MatchStanding)
	| ({ kind: "skins" } & SkinsStanding)
	| ({ kind: "sixes" } & SixesStanding)
	| ({ kind: "scramble" } & ScrambleStanding);

/**
 * Where the game stands. `null` for stroke play and Stableford, and for a round
 * whose sides don't fit its format: it shows as plain strokes, never crashes.
 */
export function formatStanding(
	round: ScoredFormatRound,
	order: readonly number[] = playingOrder(
		round.holes.length,
		round.scores,
		round.startHoleIndex,
	),
): FormatStanding | null {
	const { format, holes, scores } = round;
	if (!formatFits(format, round.players.length)) return null;
	const received = sideStrokes(round, holes);
	switch (format) {
		case "match":
			return {
				kind: format,
				...matchStanding(holes.length, scores, received, order),
			};
		case "skins":
			return {
				kind: format,
				...skinsStanding(
					holes.length,
					scores,
					received,
					carriesOver(round.formatOptions),
					order,
				),
			};
		case "sixes":
			return { kind: format, ...sixesStanding(holes.length, scores, received) };
		case "scramble":
			return { kind: format, ...scrambleStanding(holes, scores, received) };
		default:
			return null;
	}
}
