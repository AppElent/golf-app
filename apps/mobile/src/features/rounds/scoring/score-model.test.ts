import { initialDrafts, quickStrokes } from "./score-model";

describe("initialDrafts", () => {
	it("starts unscored players at par and keeps stored results", () => {
		const stored = {
			strokes: 6,
			putts: 2,
			fir: true,
			gir: false,
			penalties: 1,
			nr: true,
		};
		const drafts = initialDrafts(
			[
				{ holeIndex: 1, playerIndex: 0, strokes: 9 },
				{ holeIndex: 2, playerIndex: 1, ...stored },
			],
			2,
			2,
			4,
		);
		expect(drafts).toEqual([
			{
				strokes: 4,
				putts: null,
				fir: null,
				gir: null,
				penalties: 0,
				nr: false,
			},
			stored,
		]);
	});
});

describe("quickStrokes", () => {
	it("offers birdie to double, never below one", () => {
		expect(quickStrokes(4)).toEqual([3, 4, 5, 6]);
		expect(quickStrokes(1)).toEqual([1, 2, 3]);
	});
});
