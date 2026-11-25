import { describe, expect, it } from "vitest";
import type { HoleScore } from "./round";
import { holeNets } from "./round";
import {
	carriesOver,
	countsForPlayer,
	type FormatRound,
	formatFits,
	formatStanding,
	hasFormatOptions,
	isNet,
	sideCount,
	sideHandicaps,
	sideStrokes,
	validTeams,
} from "./round-formats";

const holes = Array.from({ length: 18 }, (_, i) => ({ strokeIndex: i + 1 }));
const players = (...handicaps: (number | undefined)[]) =>
	handicaps.map((playingHandicap) => ({ playingHandicap }));
const team = (...playerIndexes: number[]) => ({ playerIndexes });

describe("formatFits", () => {
	it.each([
		["stableford", [1, 2, 3, 4]],
		["stroke", [1, 2, 3, 4]],
		["match", [2]],
		["skins", [2, 3, 4]],
		["sixes", [3]],
		["scramble", [2, 3, 4]],
	] as const)("%s takes %j players", (format, counts) => {
		expect([1, 2, 3, 4].filter((n) => formatFits(format, n))).toEqual(counts);
	});
});

describe("format options", () => {
	it("read absent as net with carry-over", () => {
		expect(isNet(undefined)).toBe(true);
		expect(carriesOver(undefined)).toBe(true);
		expect(carriesOver({ scoring: "gross" })).toBe(true);
		expect(carriesOver({ scoring: "net", carryOver: false })).toBe(false);
		expect(isNet({ scoring: "gross" })).toBe(false);
	});

	it("exist for the four games only, and only a scramble is a team score", () => {
		expect(hasFormatOptions("stableford")).toBe(false);
		expect(hasFormatOptions("stroke")).toBe(false);
		expect(hasFormatOptions("sixes")).toBe(true);
		expect(countsForPlayer("match")).toBe(true);
		expect(countsForPlayer("scramble")).toBe(false);
	});
});

describe("validTeams", () => {
	it.each([
		[[team(0, 1)], 2],
		[[team(0, 1, 2, 3)], 4],
		[[team(3, 0), team(1, 2)], 4],
	])("accepts %j for %i players", (teams, count) => {
		expect(validTeams(teams, count)).toBe(true);
	});

	it.each([
		["no teams", [], 2],
		["a team of one", [team(0, 1), team(2)], 3],
		["the owner in team 1", [team(1, 2), team(0, 3)], 4],
		["a missing player", [team(0, 1)], 3],
		["a player twice", [team(0, 1), team(1, 2)], 4],
		["an unknown player", [team(0, 4), team(1, 2)], 4],
		["a fractional player", [team(0, 0.5)], 2],
		["three teams", [team(0, 1), team(2, 3), team(4, 5)], 6],
	])("refuses %s", (_, teams, count) => {
		expect(validTeams(teams, count)).toBe(false);
	});
});

describe("sideHandicaps", () => {
	const round = (over: Partial<FormatRound>): FormatRound => ({
		format: "skins",
		players: players(12, 7, undefined),
		...over,
	});

	it("gives everyone their own, and a player without one none", () => {
		expect(sideHandicaps(round({}))).toEqual([12, 7, 0]);
		expect(sideHandicaps(round({ format: "stableford" }))).toEqual([12, 7, 0]);
	});

	it("gives nobody strokes in a gross game", () => {
		const gross = { scoring: "gross" } as const;
		expect(sideHandicaps(round({ formatOptions: gross }))).toEqual([0, 0, 0]);
		expect(
			sideHandicaps(
				round({
					format: "scramble",
					formatOptions: gross,
					teams: [team(0, 1, 2)],
				}),
			),
		).toEqual([0]);
	});

	it("gives only the difference in a net match", () => {
		const match = (...h: (number | undefined)[]) =>
			sideHandicaps({ format: "match", players: players(...h) });
		expect(match(12, 17)).toEqual([0, 5]);
		expect(match(-2, 3)).toEqual([0, 5]);
		expect(match(undefined, 9)).toEqual([0, 9]);
		expect(match(8, 8)).toEqual([0, 0]);
	});

	it("wraps a difference above 18 to a second stroke", () => {
		const [low, high] = sideStrokes(
			{ format: "match", players: players(4, 25) },
			holes,
		);
		expect(low.every((s) => s === 0)).toBe(true);
		expect(high.slice(0, 4)).toEqual([2, 2, 2, 1]);
		expect(high.reduce((a, b) => a + b)).toBe(21);
	});

	it("ranks the stroke indexes of a 9-hole loop", () => {
		const odd = Array.from({ length: 9 }, (_, i) => ({
			strokeIndex: 2 * i + 1,
		}));
		expect(
			sideStrokes({ format: "match", players: players(0, 3) }, odd)[1],
		).toEqual([1, 1, 1, 0, 0, 0, 0, 0, 0]);
	});

	it("has one side per scramble team", () => {
		const scramble = round({
			format: "scramble",
			players: players(10, 20, 30, 4),
			teams: [team(0, 1), team(2, 3)],
		});
		expect(sideCount(scramble)).toBe(2);
		// 10 × 35% + 20 × 15% = 6.5; 4 × 35% + 30 × 15% = 5.9
		expect(sideHandicaps(scramble)).toEqual([7, 6]);
		expect(sideCount(round({}))).toBe(3);
	});
});

describe("formatStanding", () => {
	const standing = (format: FormatRound["format"], count: number) =>
		formatStanding({
			format,
			players: players(...new Array(count).fill(0)),
			teams: format === "scramble" ? [team(0, 1)] : undefined,
			holes: holes.map((hole) => ({ ...hole, par: 4 })),
			scores: [],
		})?.kind ?? null;

	it("is the game's standing, and none for stroke play and Stableford", () => {
		expect(standing("match", 2)).toBe("match");
		expect(standing("skins", 3)).toBe("skins");
		expect(standing("sixes", 3)).toBe("sixes");
		expect(standing("scramble", 2)).toBe("scramble");
		expect(standing("stroke", 2)).toBeNull();
		expect(standing("stableford", 2)).toBeNull();
	});

	it("is none when the players don't fit the format", () => {
		expect(standing("match", 3)).toBeNull();
	});
});

describe("holeNets", () => {
	const score = (playerIndex: number, rest: Partial<HoleScore>): HoleScore => ({
		holeIndex: 0,
		playerIndex,
		...rest,
	});
	const received = [[0], [1]];

	it("waits for every side, and a score without strokes is no result", () => {
		expect(holeNets([score(0, { strokes: 4 })], 0, received)).toBeNull();
		expect(
			holeNets([score(0, { strokes: 4 }), score(1, { putts: 2 })], 0, received),
		).toBeNull();
	});

	it("takes off the strokes and reads a pick-up as null", () => {
		expect(
			holeNets(
				[score(0, { strokes: 4, nr: true }), score(1, { strokes: 5 })],
				0,
				received,
			),
		).toEqual([null, 4]);
	});
});
