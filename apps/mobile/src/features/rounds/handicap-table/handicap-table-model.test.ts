import { handicapTable } from "@fairway/core/handicap-table";
import { sideStrokes } from "@fairway/core/round-formats";
import { en } from "../../../i18n/messages/en";
import { type TableRound, tablePlayers } from "./handicap-table-model";

const holes = Array.from({ length: 18 }, (_, i) => ({
	ref: String(i + 1),
	par: 4,
	strokeIndex: i + 1,
}));
const four = [10, 20, 14, 30].map((playingHandicap, i) => ({
	name: `P${i + 1}`,
	playingHandicap,
}));
const teams = [{ playerIndexes: [0, 1] }, { playerIndexes: [2, 3] }];
const columns = (round: TableRound) => tablePlayers(round, en.formats);

describe("tablePlayers (APP-894)", () => {
	it("gives only the difference in match play, and nothing in a gross one", () => {
		const round: TableRound = { format: "match", players: four.slice(0, 2) };
		expect(columns(round).map((p) => p.playingHandicap)).toEqual([0, 10]);
		expect(
			columns({ ...round, formatOptions: { scoring: "gross" } }).map(
				(p) => p.playingHandicap,
			),
		).toEqual([0, 0]);
	});

	it("gives a scramble one column per team", () => {
		expect(columns({ format: "scramble", players: four, teams })).toEqual([
			{ name: "Team 1", playingHandicap: 7 },
			{ name: "Team 2", playingHandicap: 9 },
		]);
	});

	it("keeps the full handicap in stroke play, and the dash without one", () => {
		const players = [{ name: "A", playingHandicap: 12 }, { name: "B" }];
		expect(columns({ format: "stroke", players })).toEqual([
			{ name: "A", playingHandicap: 12 },
			{ name: "B", playingHandicap: undefined },
		]);
		// Against a plus handicap, a player without one does get strokes.
		expect(
			columns({
				format: "match",
				players: [{ name: "A", playingHandicap: -2 }, { name: "B" }],
			}).map((p) => p.playingHandicap),
		).toEqual([0, 2]);
	});

	it.each([
		{ format: "match", players: four.slice(0, 2) },
		{ format: "scramble", players: four, teams },
		{ format: "skins", players: four.slice(0, 3) },
	] satisfies TableRound[])("matches the strokes a $format uses", (round) => {
		const rows = handicapTable(holes, columns(round)) ?? [];
		const used = sideStrokes(round, holes);
		expect(used.map((_, side) => rows.map((r) => r.strokes[side]))).toEqual(
			used,
		);
	});
});
