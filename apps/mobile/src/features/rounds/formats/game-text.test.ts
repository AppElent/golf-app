import type { RoundFormat } from "@fairway/core/round";
import { formatVsPar } from "@fairway/core/scoring";
import { en } from "../../../i18n/messages/en";
import { nl } from "../../../i18n/messages/nl";
import {
	formatName,
	type GameRound,
	gameText,
	newlyDecided,
	withHole,
} from "./game-text";

const holes = (count = 9) =>
	Array.from({ length: count }, (_, i) => ({
		ref: String(i + 1),
		par: 4,
		strokeIndex: i + 1,
	}));

/** `strokes[hole][side]`; null is a pick-up. */
function round(
	format: RoundFormat,
	strokes: (number | null)[][],
	over: Partial<GameRound> = {},
): GameRound {
	return {
		format,
		players: [{ name: "Eric" }, { name: "Jan" }, { name: "Piet" }].slice(
			0,
			format === "match" ? 2 : 3,
		),
		holes: holes(),
		scores: strokes.flatMap((sides, holeIndex) =>
			sides.map((s, playerIndex) => ({
				holeIndex,
				playerIndex,
				strokes: s ?? undefined,
				nr: s === null,
			})),
		),
		...over,
	};
}

const english = (r: GameRound) =>
	gameText(r, { t: en, locale: "en", vsPar: formatVsPar });
const dutch = (r: GameRound) =>
	gameText(r, { t: nl, locale: "nl", vsPar: formatVsPar });

describe("match play", () => {
	it("says who leads, and who gets a stroke here", () => {
		const r = round("match", [[4, 5]], {
			players: [
				{ name: "Eric", playingHandicap: 4 },
				{ name: "Jan", playingHandicap: 6 },
			],
		});
		expect(dutch(r).sheetStanding(1)).toEqual({
			title: "All square",
			sub: "Nog 8 holes · Jan krijgt een slag op deze hole (HCP 2)",
		});
		expect(dutch(r).capsule(1)).toBe("All square · nog 8 holes");
	});

	it("previews what saving a hole does", () => {
		expect(dutch(round("match", [[4, 5]])).holeResult(0)).toEqual({
			title: "Eric wint de hole · Eric 1 UP",
			sub: "Netto 4 tegen 5. Opslaan zet de stand op Eric 1 UP, nog 8 holes.",
		});
	});

	it("ends with the result, and stops the card's row there", () => {
		const r = round(
			"match",
			Array.from({ length: 6 }, () => [4, 5]),
		);
		const text = dutch(r);
		expect(text.capsule(6)).toBe("Eric wint 5&4");
		expect(text.cardRows()[0].cells.map((c) => c?.text ?? null)).toEqual([
			"E1",
			"E2",
			"E3",
			"E4",
			"E5",
			null,
			null,
			null,
			null,
		]);
		expect(text.cardRows()[0].cells[1]?.spoken).toBe("Hole 2, Eric 2 UP");
		expect(text.result()).toMatchObject({
			kicker: "Matchplay tegen Jan",
			title: "Eric wint 5&4",
			sub: "Beslist op hole 5. Hole 6 is uitgespeeld voor de score.",
		});
		expect(text.share(["24", "30"])).toEqual({
			title: "Eric wint 5&4 van Jan",
			sub: "Matchplay netto · Eric 24 · Jan 30",
		});
	});

	it("asks to play out only when saving decided it with holes left", () => {
		const standing = (n: number) =>
			english(
				round(
					"match",
					Array.from({ length: n }, () => [4, 5]),
				),
			).standing;
		expect(newlyDecided(standing(4), standing(5))).toEqual({
			winner: 0,
			left: 4,
		});
		expect(newlyDecided(standing(5), standing(6))).toBeNull();
		expect(newlyDecided(standing(3), standing(4))).toBeNull();
	});

	it("reads a halved match", () => {
		const r = round(
			"match",
			Array.from({ length: 9 }, () => [4, 4]),
		);
		expect(english(r).result()).toMatchObject({
			title: "Match halved",
			sub: "",
		});
	});
});

describe("skins", () => {
	const tied = [4, 4, 5];

	it("says what the hole is worth", () => {
		expect(dutch(round("skins", [tied])).sheetStanding(1)).toEqual({
			title: "Skin op hole 2 is 2 waard",
			sub: "1 doorgeschoven van hole 1",
		});
	});

	it("says who takes it, or that it carries over", () => {
		expect(dutch(round("skins", [tied])).holeResult(0)).toEqual({
			title: "Gelijk: Eric en Jan netto 4",
			sub: "Niemand wint alleen, dus de skin schuift door. Hole 2 is 2 waard.",
		});
		expect(dutch(round("skins", [tied, [5, 4, 5]])).holeResult(1)).toEqual({
			title: "Jan pakt 2 skins",
			sub: "Netto 4.",
		});
	});

	it("lists what was won and what stayed on the table", () => {
		const text = dutch(round("skins", [[3, 4, 4], tied]));
		expect(text.result()).toMatchObject({
			title: "Eric wint met 1",
			list: {
				rows: [
					{ label: "Eric", value: "1 skin" },
					{ label: "Jan", value: "0 skins" },
					{ label: "Piet", value: "0 skins" },
					{ label: "Op tafel", value: "1 skin" },
				],
			},
		});
		expect(text.cardRows()[0].cells[0]?.spoken).toBe(
			"Hole 1, Eric wint 1 skin",
		);
		expect(text.cardRows()[0].cells[1]?.text).toBe("→");
	});

	it("doesn't carry over when that is off", () => {
		const r = round("skins", [tied], {
			formatOptions: { scoring: "gross", carryOver: false },
		});
		expect(english(r).holeResult(0)).toEqual({
			title: "Tied: Eric and Jan gross 4",
			sub: "Nobody wins alone, so nobody gets the skin.",
		});
	});
});

describe("sixes", () => {
	it.each([
		[
			[4, 5, 5],
			"Eric 4 · Jan 1 · Piet 1",
			"Eric wint netto 4; Jan en Piet delen de tweede plek met netto 5.",
		],
		[
			[4, 4, 5],
			"Eric 3 · Jan 3 · Piet 0",
			"Eric en Jan delen de eerste plek met netto 4.",
		],
		[[5, 5, 5], "Eric 2 · Jan 2 · Piet 2", "Alle drie gelijk met netto 5."],
		[
			[6, 5, 4],
			"Piet 4 · Jan 2 · Eric 0",
			"Piet wint netto 4; Jan wordt tweede met netto 5.",
		],
		[
			[4, 5, null],
			"Eric 4 · Jan 2 · Piet 0",
			"Eric wint netto 4; Jan wordt tweede met netto 5.",
		],
	])("shares out %j", (scores, title, sub) => {
		expect(dutch(round("sixes", [scores])).holeResult(0)).toEqual({
			title,
			sub,
		});
	});

	it("lists points per player and hole", () => {
		const text = english(round("sixes", [[4, 5, 5]]));
		expect(text.sheetStanding(1)).toEqual({
			title: "Eric 4 · Jan 1 · Piet 1",
			sub: "After 1 hole",
		});
		expect(text.cardRows().map((row) => row.cells[0]?.text)).toEqual([
			"4",
			"1",
			"1",
		]);
	});
});

describe("scramble", () => {
	const teams = {
		players: ["Eric", "Anna", "Piet", "Jan"].map((name) => ({ name })),
		teams: [{ playerIndexes: [0, 1] }, { playerIndexes: [2, 3] }],
	};

	it("plays as teams, with the holes they won", () => {
		const text = english(
			round(
				"scramble",
				[
					[4, 5],
					[4, 4],
				],
				teams,
			),
		);
		expect(text.sides).toEqual([
			{ name: "Team 1", members: "Eric, Anna" },
			{ name: "Team 2", members: "Piet, Jan" },
		]);
		expect(text.cardStanding()).toEqual({
			title: "Team 1 E · Team 2 +1",
			sub: "Net · holes won 1–0",
		});
		expect(text.result()?.title).toBe("Team 1 wins");
		expect(text.cardRows()[0].cells.map((c) => c?.text ?? null)).toEqual([
			"1",
			"–",
			...Array.from({ length: 7 }, () => null),
		]);
	});

	it("is one team against par otherwise", () => {
		const text = english(
			round("scramble", [[3]], {
				...teams,
				teams: [{ playerIndexes: [0, 1, 2, 3] }],
			}),
		);
		expect(text.capsule(1)).toBe("Team −1");
		expect(text.cardRows()).toEqual([]);
		expect(text.holeResult(0)).toBeNull();
	});
});

it("has nothing to say about stroke play, or players that don't fit", () => {
	for (const r of [
		round("stroke", [[4, 4, 4]]),
		round("match", [[4, 4]], { players: [{ name: "Eric" }] }),
	]) {
		const text = english(r);
		expect(text.sheetStanding(0)).toBeNull();
		expect(text.capsule(0)).toBeNull();
		expect(text.cardRows()).toEqual([]);
		expect(text.result()).toBeNull();
	}
});

it("names a format with its scoring", () => {
	expect(formatName({ format: "stableford" }, en)).toBe("Stableford");
	expect(formatName({ format: "match" }, en)).toBe("Match play net");
	expect(
		formatName({ format: "skins", formatOptions: { scoring: "gross" } }, nl),
	).toBe("Skins bruto");
});

it("replaces one hole's scores with what was entered", () => {
	expect(
		withHole(
			[
				{ holeIndex: 0, playerIndex: 0, strokes: 4 },
				{ holeIndex: 1, playerIndex: 0, strokes: 5 },
			],
			0,
			[
				{ strokes: 3, nr: false },
				{ strokes: null, nr: false },
			],
		),
	).toEqual([
		{ holeIndex: 1, playerIndex: 0, strokes: 5 },
		{ holeIndex: 0, playerIndex: 0, strokes: 3, nr: false },
	]);
});
