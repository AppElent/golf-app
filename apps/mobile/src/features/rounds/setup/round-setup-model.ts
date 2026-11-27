import {
	OWNER_INDEX,
	type RoundFormat,
	type RoundTeam,
} from "@fairway/core/round";
import { FORMAT_PLAYERS, formatFits } from "@fairway/core/round-formats";

/** A round has the owner and at most three guests. */
export const MAX_PLAYERS = 4;

/** The formats a round can start in, in the order their tiles are drawn. */
export const FORMAT_TILES: readonly RoundFormat[] = [
	"stableford",
	"stroke",
	"match",
	"skins",
	"sixes",
	"scramble",
];

/** The formats this many players can't start, grouped by what they need. */
export function unfitFormats(
	playerCount: number,
): { formats: RoundFormat[]; min: number; max: number }[] {
	const groups: { formats: RoundFormat[]; min: number; max: number }[] = [];
	for (const format of FORMAT_TILES) {
		if (formatFits(format, playerCount)) continue;
		const { min, max = MAX_PLAYERS } = FORMAT_PLAYERS[format];
		const group = groups.find((g) => g.min === min && g.max === max);
		if (group) group.formats.push(format);
		else groups.push({ formats: [format], min, max });
	}
	return groups;
}

/** Two teams need four players. */
export const TWO_TEAM_PLAYERS = 4;

/** The teams of a scramble; with two, the owner plays with `partner`. */
export function scrambleTeams(
	playerCount: number,
	teamCount: 1 | 2,
	partner: number,
): RoundTeam[] {
	const all = Array.from({ length: playerCount }, (_, i) => i);
	if (teamCount === 1 || playerCount < TWO_TEAM_PLAYERS) {
		return [{ playerIndexes: all }];
	}
	const own = (i: number) => i === OWNER_INDEX || i === partner;
	return [
		{ playerIndexes: all.filter(own) },
		{ playerIndexes: all.filter((i) => !own(i)) },
	];
}

/** Who the owner plays with after a tap on `tapped`, keeping teams at two. */
export function nextPartner(
	teams: readonly RoundTeam[],
	partner: number,
	tapped: number,
): number {
	if (tapped === OWNER_INDEX) return partner;
	// The partner trades places with the other team's first player.
	return tapped === partner ? (teams[1]?.playerIndexes[0] ?? partner) : tapped;
}

/**
 * A tap on a loop's tile. At most two picks (18 holes): a picked loop is played
 * twice, then not at all; another loop joins a single pick, else starts over.
 */
export function toggleLoopPick(
	picks: readonly number[],
	index: number,
): number[] {
	const count = picks.filter((pick) => pick === index).length;
	if (count === 2) return [];
	if (count === 1) return [index, index];
	return picks.length >= 2 ? [index] : [...picks, index];
}

/** 1 or 2 when two different loops are picked: the order they are played in. */
export function loopOrder(
	picks: readonly number[],
	index: number,
): 1 | 2 | null {
	if (picks.length !== 2 || picks[0] === picks[1]) return null;
	const at = picks.indexOf(index);
	return at === 0 ? 1 : at === 1 ? 2 : null;
}

/** The loop played twice, or null when every pick is a different loop. */
export function doubledLoop(picks: readonly number[]): number | null {
	return picks.length === 2 && picks[0] === picks[1] ? picks[0] : null;
}

/** The letter in a player's avatar. */
export function playerInitial(name: string): string {
	return (Array.from(name.trim())[0] ?? "").toUpperCase();
}

/** A playing handicap as it is read: 14, or "+2" for a plus player's -2. */
export function playingHandicapText(value: number): string {
	return value < 0 ? `+${-value}` : String(value);
}

/** The tee last played on this course, else the course's first tee. */
export function defaultTeeId<Id extends string>(
	tees: ReadonlyArray<{ _id: Id }>,
	lastTeeId: Id | null | undefined,
): Id | null {
	if (lastTeeId && tees.some((t) => t._id === lastTeeId)) return lastTeeId;
	return tees[0]?._id ?? null;
}

interface LengthHole {
	ref?: string;
	lengthMeters?: number;
	lengths?: Record<string, number>;
}

/**
 * The selected holes' length from this tee, in meters: each hole's length for
 * the tee's marker, else its general length. `null` when any hole has none, so
 * a partial sum never passes for the course length.
 */
export function teeLengthMeters(
	tee: { marker?: string },
	holes: ReadonlyArray<LengthHole>,
	holeRefs: ReadonlyArray<string>,
): number | null {
	if (holeRefs.length === 0) return null;
	const byRef = new Map(holes.map((h) => [h.ref, h]));
	let total = 0;
	for (const ref of holeRefs) {
		const hole = byRef.get(ref);
		const length =
			(tee.marker ? hole?.lengths?.[tee.marker] : undefined) ??
			hole?.lengthMeters;
		if (length === undefined) return null;
		total += length;
	}
	return total;
}

/**
 * The holes a round can start on: each hole once, at its first place in the
 * round. A loop played twice starts on its first pass.
 */
export function startHoleChoices(
	holeRefs: readonly string[],
): { index: number; ref: string }[] {
	return holeRefs.flatMap((ref, index) =>
		holeRefs.indexOf(ref) === index ? [{ index, ref }] : [],
	);
}
