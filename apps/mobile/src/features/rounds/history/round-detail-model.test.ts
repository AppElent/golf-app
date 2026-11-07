import type { Messages } from "../../../i18n/messages/en";
import {
	markCounts,
	roundTiles,
	shareCardStats,
	shareMessage,
} from "./round-detail-model";

/** Stand-in copy: these tests are about which figures appear, not the wording. */
const copy = {
	score: "Score",
	toPar: "To par",
	net: "Net",
	points: "Points",
	differential: "Differential",
	differentialNine: "9-hole differential",
	putts: "Putts",
	fairways: "Fairways",
	greens: "Greens",
	markShort: {
		eagle: "Eagle",
		birdie: "Birdie",
		par: "Par",
		bogey: "Bogey",
		double: "Double",
	},
	shareFooter: "Shared from Fairway",
} as unknown as Messages["rounds"];

type TilesInput = Parameters<typeof roundTiles>[0];

const tiles = (over: Partial<TilesInput> = {}) =>
	roundTiles({
		owner: { scored: 18, total: 90, toPar: "+18", points: 30 },
		recap: { net: 72, netToPar: 0 },
		extra: { putts: 34, firEligible: 14, firMade: 8, girHoles: 18, girMade: 6 },
		format: "stroke",
		holeCount: 18,
		differential: 15.3,
		decimal: (n) => n.toFixed(1),
		vsPar: (n) => (n === 0 ? "E" : `+${n}`),
		copy,
		...over,
	});

const net = { label: "Net", value: "72", sub: "E" };
const differential = { label: "Differential", value: "15.3" };
const putts = { label: "Putts", value: "34" };
const fairways = { label: "Fairways", value: "8/14" };
const greens = { label: "Greens", value: "6/18" };
const noExtras = {
	putts: null,
	firEligible: 0,
	firMade: 0,
	girHoles: 0,
	girMade: 0,
};

describe("roundTiles", () => {
	it("leads a stroke round with its score, then net and the rest, without points", () => {
		const result = tiles();
		expect(result.score).toEqual({ label: "Score", value: "90" });
		expect(result.toPar).toEqual({ label: "To par", value: "+18" });
		expect(result.stats).toEqual([net, differential, putts, fairways, greens]);
	});

	it("adds points after net for a stableford round", () => {
		expect(tiles({ format: "stableford" }).stats).toEqual([
			net,
			{ label: "Points", value: "30" },
			differential,
			putts,
			fairways,
			greens,
		]);
	});

	it("names the differential of a 9-hole round", () => {
		expect(tiles({ holeCount: 9 }).stats[1].label).toBe("9-hole differential");
	});

	it("leaves out what the round does not have", () => {
		expect(
			tiles({
				recap: { net: null, netToPar: null },
				differential: null,
				extra: noExtras,
			}).stats,
		).toEqual([]);
		expect(tiles({ differential: undefined }).stats).not.toContainEqual(
			differential,
		);
	});

	it("keeps a figure that is zero", () => {
		const result = tiles({
			differential: 0,
			extra: { ...noExtras, putts: 0 },
			recap: { net: 0, netToPar: -72 },
			format: "stableford",
			owner: { scored: 18, total: 90, toPar: "+18", points: 0 },
		});
		expect(result.stats.map((tile) => tile.value)).toEqual([
			"0",
			"0",
			"0.0",
			"0",
		]);
	});

	it("shows a dash before anything is scored", () => {
		const result = tiles({
			owner: { scored: 0, total: 0, toPar: null, points: 0 },
		});
		expect(result.score.value).toBe("–");
		expect(result.toPar.value).toBe("–");
	});
});

describe("shareCardStats", () => {
	it("has room for the first three stats", () => {
		expect(shareCardStats(tiles())).toEqual([net, differential, putts]);
	});
});

describe("markCounts", () => {
	it("lists the results a round has, best first", () => {
		expect(
			markCounts(
				{ double: 2, bogey: 5, par: 10, birdie: 1, eagle: 0 },
				copy.markShort,
			),
		).toEqual([
			{ label: "Birdie", count: 1 },
			{ label: "Par", count: 10 },
			{ label: "Bogey", count: 5 },
			{ label: "Double", count: 2 },
		]);
	});
});

describe("shareMessage", () => {
	const base = {
		courseName: "Welderen",
		detail: "Saturday · Yellow",
		ninesText: "Out 45 · In 45",
		marks: { eagle: 0, birdie: 1, par: 10, bogey: 5, double: 2 },
		copy,
	};

	it("spreads a full round over its lines", () => {
		expect(shareMessage({ ...base, tiles: tiles() }).split("\n")).toEqual([
			"⛳ Welderen",
			"Saturday · Yellow",
			"",
			"Score 90 · To par +18 · Net 72 (E) · Differential 15.3",
			"Out 45 · In 45",
			"Birdie 1 · Par 10 · Bogey 5 · Double 2",
			"Putts 34 · Fairways 8/14 · Greens 6/18",
			"",
			"Shared from Fairway",
		]);
	});

	it("moves the next stats up when a round has no net or points", () => {
		const noNet = tiles({ recap: { net: null, netToPar: null } });
		expect(shareMessage({ ...base, tiles: noNet }).split("\n")).toEqual([
			"⛳ Welderen",
			"Saturday · Yellow",
			"",
			"Score 90 · To par +18 · Differential 15.3 · Putts 34",
			"Out 45 · In 45",
			"Birdie 1 · Par 10 · Bogey 5 · Double 2",
			"Fairways 8/14 · Greens 6/18",
			"",
			"Shared from Fairway",
		]);
	});

	it("has no nines line for 9 holes and no stats line without stats to spare", () => {
		const bare = tiles({
			recap: { net: null, netToPar: null },
			differential: null,
			extra: noExtras,
		});
		expect(
			shareMessage({ ...base, ninesText: null, tiles: bare }).split("\n"),
		).toEqual([
			"⛳ Welderen",
			"Saturday · Yellow",
			"",
			"Score 90 · To par +18",
			"Birdie 1 · Par 10 · Bogey 5 · Double 2",
			"",
			"Shared from Fairway",
		]);
	});
});
