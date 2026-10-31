import {
	cardRows,
	draftToScore,
	initialDrafts,
	quickStrokes,
	unscoredHoles,
} from "./score-model";

describe("initialDrafts", () => {
	it("starts unscored players at par and keeps stored results", () => {
		const drafts = initialDrafts(
			[{ holeIndex: 2, playerIndex: 1, strokes: 6, putts: 2, gir: false }],
			2,
			2,
			4,
		);
		expect(drafts[0]).toMatchObject({ strokes: 4, putts: null, penalties: 0 });
		expect(drafts[1]).toMatchObject({ strokes: 6, putts: 2, gir: false });
	});
});

describe("quickStrokes", () => {
	it("offers birdie to double, never below one", () => {
		expect(quickStrokes(4)).toEqual([3, 4, 5, 6]);
		expect(quickStrokes(1)).toEqual([1, 2, 3]);
	});
});

describe("draftToScore", () => {
	it("drops unanswered stats instead of storing nulls", () => {
		expect(
			draftToScore({
				strokes: 5,
				putts: null,
				fir: null,
				gir: true,
				penalties: 0,
				nr: false,
			}),
		).toEqual({
			strokes: 5,
			putts: undefined,
			fir: undefined,
			gir: true,
			penalties: 0,
			nr: false,
		});
	});
});

describe("cardRows", () => {
	const holes = Array.from({ length: 18 }, (_, i) => ({
		par: 4,
		strokeIndex: i + 1,
	}));

	it("splits Out / In and scores to par over played holes only", () => {
		const [row] = cardRows(
			holes,
			[
				{ holeIndex: 0, playerIndex: 0, strokes: 3 },
				{ holeIndex: 9, playerIndex: 0, strokes: 6 },
			],
			[{ playingHandicap: 0 }],
		);
		expect(row.nines).toEqual([3, 6]);
		expect(row.total).toBe(9);
		expect(row.toPar).toBe("+1");
		expect(row.cells[0].mark).toBe("birdie");
		expect(row.scored).toBe(2);
		expect(row.points).toBe(3 + 0);
	});

	it("shows a pick-up as no score", () => {
		const [row] = cardRows(
			holes.slice(0, 9),
			[{ holeIndex: 0, playerIndex: 0, strokes: 9, nr: true }],
			[{}],
		);
		expect(row.cells[0]).toEqual({ strokes: null, mark: null, nr: true });
		expect(row.nines).toEqual([0]);
		expect(row.toPar).toBeNull();
	});
});

describe("unscoredHoles", () => {
	it("lists the owner's holes without strokes or a pick-up", () => {
		expect(
			unscoredHoles(4, [
				{ holeIndex: 0, playerIndex: 0, strokes: 4 },
				{ holeIndex: 1, playerIndex: 1, strokes: 4 },
				{ holeIndex: 2, playerIndex: 0, nr: true },
			]),
		).toEqual([1, 3]);
	});
});
