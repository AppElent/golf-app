import { describe, expect, it } from "vitest";
import { matchStanding } from "./match-play";
import { type HoleScore, playingOrder, type RecordedScore } from "./round";
import { formatStanding } from "./round-formats";
import { scrambleStanding, teamHandicap } from "./scramble";
import { sixesPoints, sixesStanding } from "./sixes";
import { skinsStanding, skinValue } from "./skins";

/** "x" is a pick-up, null not entered; one row per side. */
type Entry = number | "x" | null;
const card = (...rows: Entry[][]): HoleScore[] =>
	rows.flatMap((row, playerIndex) =>
		row.flatMap((entry, holeIndex): HoleScore[] =>
			entry === null
				? []
				: [
						entry === "x"
							? { holeIndex, playerIndex, nr: true }
							: { holeIndex, playerIndex, strokes: entry },
					],
		),
	);
const none = (sides: number, holes: number) =>
	Array.from({ length: sides }, () => new Array<number>(holes).fill(0));

/** A match from hole winners: "0", "1" or "=" per hole. */
const match = (winners: string, holeCount = 18) =>
	matchStanding(
		holeCount,
		card(
			[...winners].map((w) => (w === "1" ? 5 : 4)),
			[...winners].map((w) => (w === "0" ? 5 : 4)),
		),
		none(2, holeCount),
	);

describe("matchStanding", () => {
	it("is all square before the first hole", () => {
		expect(match("")).toMatchObject({
			leader: null,
			up: 0,
			played: 0,
			toPlay: 18,
			dormie: false,
			halved: false,
			result: null,
		});
	});

	it("counts holes up, halves included in the holes played", () => {
		expect(match("0=01=0")).toMatchObject({ leader: 0, up: 2, toPlay: 12 });
		expect(match("1")).toMatchObject({ leader: 1, up: 1, lead: -1 });
	});

	it("knows dormie, which a half on the next hole turns into a win", () => {
		expect(match(`00${"=".repeat(14)}`)).toMatchObject({
			dormie: true,
			up: 2,
			toPlay: 2,
		});
		expect(match(`00${"=".repeat(15)}`).result).toEqual({
			winner: 0,
			up: 2,
			left: 1,
			holeIndex: 16,
		});
	});

	it("ends early: 3&2 and 10&8", () => {
		expect(match(`111${"=".repeat(13)}`).result).toMatchObject({
			winner: 1,
			up: 3,
			left: 2,
		});
		expect(match("0".repeat(10)).result).toMatchObject({ up: 10, left: 8 });
	});

	it("can be won 1 up on the last hole", () => {
		expect(match(`${"=".repeat(17)}0`).result).toEqual({
			winner: 0,
			up: 1,
			left: 0,
			holeIndex: 17,
		});
	});

	it("is halved when level after the last hole", () => {
		const standing = match(`01${"=".repeat(16)}`);
		expect(standing).toMatchObject({
			halved: true,
			result: null,
			leader: null,
		});
		expect(standing.dormie).toBe(false);
	});

	it("is not changed by holes played out after it is decided", () => {
		const standing = match(`${"0".repeat(10)}${"1".repeat(8)}`);
		expect(standing).toMatchObject({ up: 10, toPlay: 0, dormie: false });
		expect(standing.result).toMatchObject({ up: 10, left: 8, holeIndex: 9 });
		expect(standing.holes[17]).toMatchObject({ winner: 1, lead: 10 });
	});

	it("works over nine holes", () => {
		expect(match("00000", 9).result).toMatchObject({ up: 5, left: 4 });
	});

	it("loses a hole with a pick-up, and halves it when both pick up", () => {
		const { holes } = matchStanding(
			9,
			card(["x", "x", 9], [8, "x", "x"]),
			none(2, 9),
		);
		expect(holes.slice(0, 3).map((h) => h?.winner)).toEqual([1, null, 0]);
	});

	it("uses the strokes received", () => {
		const standing = matchStanding(9, card([4, 4], [5, 5]), [
			[0, 0],
			[1, 0],
		]);
		expect(standing.holes.slice(0, 2).map((h) => h?.winner)).toEqual([null, 0]);
	});

	it("leaves out holes one player has not entered", () => {
		const standing = matchStanding(
			9,
			card([4, 4, 4], [5, null, 5]),
			none(2, 9),
		);
		expect(standing).toMatchObject({ up: 2, played: 2, toPlay: 7 });
		expect(standing.holes[1]).toBeNull();
	});
});

describe("skinsStanding", () => {
	const skins = (carryOver: boolean, ...rows: Entry[][]) =>
		skinsStanding(9, card(...rows), none(rows.length, 9), carryOver);

	it("gives a skin to the only best score", () => {
		expect(skins(true, [4, 5], [5, 4], [5, 5])).toMatchObject({
			won: [1, 1, 0],
			carried: 0,
			toPlay: 7,
		});
	});

	it("carries ties until someone wins alone", () => {
		const standing = skins(true, [4, 4, 3], [4, 4, 4], [5, 5, 4]);
		expect(standing.won).toEqual([3, 0, 0]);
		expect(standing.holes[2]).toMatchObject({ winner: 0, value: 3 });
		expect(standing.holes[0]).toMatchObject({ winner: null, tied: [0, 1] });
	});

	it("leaves trailing ties on the table", () => {
		const even = new Array<Entry>(9).fill(4);
		const standing = skins(true, [3, ...even.slice(1)], even);
		expect(standing.won).toEqual([1, 0]);
		expect(standing.carried).toBe(8);
		expect(standing.carriedFrom).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		expect(standing.toPlay).toBe(0);
	});

	it("drops tied skins without carry-over", () => {
		const standing = skins(false, [4, 3], [4, 4]);
		expect(standing.won).toEqual([1, 0]);
		expect(standing.carried).toBe(0);
	});

	it("never gives a skin to a pick-up", () => {
		expect(skins(true, ["x", "x"], [9, "x"])).toMatchObject({
			won: [0, 1],
			carriedFrom: [1],
		});
		expect(skins(true, ["x"], ["x"]).holes[0]?.tied).toEqual([]);
	});

	it("uses the strokes received", () => {
		expect(skinsStanding(9, card([4], [5]), [[0], [2]], true).won).toEqual([
			0, 1,
		]);
	});

	it("values a hole from the holes before it only", () => {
		const scores = card([4, 4, 3, 4], [4, 4, 4, 4]);
		const value = (hole: number) =>
			skinValue(hole, 9, scores, none(2, 9), true);
		expect(value(0)).toEqual({ value: 1, carriedFrom: [] });
		expect(value(2)).toEqual({ value: 3, carriedFrom: [0, 1] });
		expect(value(3)).toEqual({ value: 1, carriedFrom: [] });
	});
});

describe("sixesPoints", () => {
	it.each([
		[
			[3, 4, 5],
			[4, 2, 0],
		],
		[
			[4, 4, 5],
			[3, 3, 0],
		],
		[
			[5, 3, 5],
			[1, 4, 1],
		],
		[
			[4, 4, 4],
			[2, 2, 2],
		],
		[
			[null, 4, 5],
			[0, 4, 2],
		],
		[
			[null, 4, null],
			[1, 4, 1],
		],
		[
			[null, null, null],
			[2, 2, 2],
		],
	])("%j → %j", (nets, points) => {
		expect(sixesPoints(nets)).toEqual(points);
	});
});

describe("sixesStanding", () => {
	it("adds up the holes all three have played", () => {
		const standing = sixesStanding(
			9,
			card([4, 4, 4], [5, 4, 4], [6, 5, null]),
			none(3, 9),
		);
		expect(standing.totals).toEqual([7, 5, 0]);
		expect(standing).toMatchObject({ played: 2, toPlay: 7 });
		expect(standing.holes[2]).toBeNull();
	});

	it("uses the strokes received", () => {
		const { totals } = sixesStanding(9, card([4], [5], [5]), [[0], [1], [2]]);
		// nets 4, 4, 3
		expect(totals).toEqual([1, 1, 4]);
	});
});

describe("teamHandicap", () => {
	it.each([
		["35/15", [10, 20], 7],
		["lowest first, in any order", [20, 10], 7],
		["30/20/10", [10, 20, 30], 10],
		["25/20/15/10", [10, 20, 30, 40], 15],
		["rounded down", [4, 30], 6],
		["a half rounded up", [9, 9], 5],
		["a plus handicap first", [-4, 20], 2],
		["nobody with a handicap", [0, 0], 0],
	])("%s", (_, handicaps, expected) => {
		expect(teamHandicap(handicaps)).toBe(expected);
	});

	it("has no negative zero", () => {
		expect(Object.is(teamHandicap([-1, 0]), 0)).toBe(true);
	});
});

describe("scrambleStanding", () => {
	const holes = Array.from({ length: 9 }, () => ({ par: 4 }));

	it("totals one team against par", () => {
		const { teams, played } = scrambleStanding(holes, card([4, 3, "x"]), [
			[1, 0, 0],
		]);
		expect(teams).toEqual([
			{
				strokes: 7,
				net: 6,
				vsPar: -1,
				netVsPar: -2,
				scored: 2,
				holesWon: 0,
				pickedUp: 1,
			},
		]);
		expect(played).toBe(3);
	});

	it("counts the holes two teams win, on net", () => {
		const { teams } = scrambleStanding(
			holes,
			card([4, 4, "x", "x", 3], [4, 4, 5, "x", null]),
			[
				[0, 0],
				[1, 0],
			],
		);
		expect(teams.map((t) => t.holesWon)).toEqual([0, 2]);
		expect(teams.map((t) => t.netVsPar)).toEqual([0, 0]);
	});

	it("totals two teams over the holes both entered, like the winner (APP-894)", () => {
		// With its third hole, team 1 would show 13 against team 2's 9.
		const { teams, winner, played, toPlay } = scrambleStanding(
			holes,
			card([4, 4, 5], [5, 4, null]),
			none(2, 9),
		);
		expect(winner).toBe(0);
		expect(teams.map((t) => t.strokes)).toEqual([8, 9]);
		expect(teams.map((t) => t.vsPar)).toEqual([0, 1]);
		expect([played, toPlay]).toEqual([2, 7]);
	});

	it.each([
		["the lower net", [4, 4], [4, 5], 0],
		["equal nets", [4, 5], [5, 4], "tied"],
		["a team that picked up a hole", [5, 5], [5, "x"], 0],
		["both teams picking up", ["x", 5], [5, "x"], null],
		["a hole one team hasn't entered", [5, 5], [6, null], 0],
	] as [string, Entry[], Entry[], unknown][])(
		"names the winner with %s",
		(_, a, b, winner) => {
			expect(scrambleStanding(holes, card(a, b), none(2, 9)).winner).toBe(
				winner,
			);
		},
	);
});

describe("a round started on hole 10 (APP-894)", () => {
	/** Scores of two players, entered in this hole order. */
	const entered = (
		order: readonly number[],
		strokes: (hole: number) => [number, number],
	): RecordedScore[] =>
		order.flatMap((holeIndex, i) =>
			strokes(holeIndex).map((s, playerIndex) => ({
				holeIndex,
				playerIndex,
				strokes: s,
				_creationTime: 1000 + i * 10 + playerIndex,
			})),
		);
	const card18 = Array.from({ length: 18 }, (_, i) => i);
	const from10 = [...card18.slice(9), ...card18.slice(0, 9)];
	const even = (): [number, number] => [4, 4];

	it("plays in the order it was entered", () => {
		expect(playingOrder(18, entered(from10, even))).toEqual(from10);
		expect(playingOrder(18, entered(from10.slice(0, 11), even))).toEqual(
			from10,
		);
		expect(playingOrder(18, entered(card18, even))).toEqual(card18);
		expect(playingOrder(18, [])).toEqual(card18);
	});

	it("takes the hole being entered as the latest", () => {
		const now = { holeIndex: 0, playerIndex: 0, strokes: 4 };
		expect(
			playingOrder(18, [...entered(from10.slice(0, 9), even), now]),
		).toEqual(from10);
	});

	it("keeps card order for a hole entered late", () => {
		expect(playingOrder(18, entered([1, 2, 0, 3, 4], even))).toEqual(card18);
		expect(
			playingOrder(18, entered([0, 1, 3, 4, ...card18.slice(5), 2], even)),
		).toEqual(card18);
	});

	it("decides a match on the hole it was decided on", () => {
		// Player 0 wins every hole: 10&8 after ten holes, on hole 1.
		const scores = entered(from10, () => [4, 5]);
		const standing = formatStanding({
			format: "match",
			players: [{}, {}],
			holes: card18.map((i) => ({ par: 4, strokeIndex: i + 1 })),
			scores,
		});
		expect(standing).toMatchObject({
			result: { winner: 0, up: 10, left: 8, holeIndex: 0 },
		});
	});

	it("carries a skin to the hole played next", () => {
		// Tied on 18, won on 1.
		const strokes = (h: number): [number, number] =>
			h === 17 ? [4, 4] : [3, 4];
		const standing = skinsStanding(
			18,
			entered(from10, strokes),
			none(2, 18),
			true,
			from10,
		);
		expect(standing.holes[0]).toMatchObject({ winner: 0, value: 2 });
		expect(standing.carried).toBe(0);
		expect(
			skinValue(0, 18, entered(from10, strokes), none(2, 18), true, from10),
		).toEqual({ value: 2, carriedFrom: [17] });
	});
});
