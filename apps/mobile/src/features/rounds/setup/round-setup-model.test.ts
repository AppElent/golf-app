import {
	courseLoops,
	parseIndex,
	playingHandicapPreview,
	selection,
	toggleLoopPick,
} from "./round-setup-model";

const holes = [
	...Array.from({ length: 18 }, (_, i) => ({
		ref: String(i + 1),
		number: i + 1,
		par: 4,
		strokeIndex: i + 1,
	})),
	{ ref: "(1)", number: 1, par: 3 },
];

describe("round setup model", () => {
	it("detects front, back and the parenthesised loop", () => {
		expect(courseLoops(holes).map((l) => l.label)).toEqual([
			"1–9",
			"10–18",
			"(1)–(1)",
		]);
	});

	it("allows at most two picks and restarts on the third", () => {
		expect(toggleLoopPick([], 0)).toEqual([0]);
		expect(toggleLoopPick([0], 0)).toEqual([0, 0]);
		expect(toggleLoopPick([0, 1], 2)).toEqual([2]);
	});

	it("totals par and flags holes without par or stroke index", () => {
		const loops = courseLoops(holes);
		const front = selection(holes, loops, [0, 1]);
		expect(front.holeRefs).toHaveLength(18);
		expect(front.par).toBe(72);
		expect(front.incomplete).toEqual([]);
		expect(front.label).toBe("1–9 + 10–18");
		expect(selection(holes, loops, [2]).incomplete).toEqual(["(1)"]);
	});

	it("parses Dutch and English decimals and rejects nonsense", () => {
		expect(parseIndex("12,4")).toBe(12.4);
		expect(parseIndex(" 8.0 ")).toBe(8);
		expect(parseIndex("")).toBeUndefined();
		expect(parseIndex("99")).toBeUndefined();
	});

	it("previews the playing handicap only with a tee and holes", () => {
		const tee = { slopeRating: 130, courseRating: 72.1 };
		expect(playingHandicapPreview("18", tee, 72)).toBe(21);
		expect(playingHandicapPreview("18", undefined, 72)).toBeUndefined();
		expect(playingHandicapPreview("18", tee, 0)).toBeUndefined();
	});
});
