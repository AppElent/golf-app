import {
	defaultTeeId,
	teeLengthMeters,
	toggleLoopPick,
	visibleTees,
} from "./round-setup-model";

describe("toggleLoopPick", () => {
	it("allows at most two picks and restarts on the third", () => {
		expect(toggleLoopPick([], 0)).toEqual([0]);
		expect(toggleLoopPick([0], 0)).toEqual([0, 0]);
		expect(toggleLoopPick([0, 1], 2)).toEqual([2]);
	});
});

describe("defaultTeeId", () => {
	const tees = [{ _id: "white" }, { _id: "yellow" }, { _id: "red" }];

	it("prefers the tee last played on the course", () => {
		expect(defaultTeeId(tees, "yellow")).toBe("yellow");
	});

	it("falls back to the first tee without a usable last tee", () => {
		expect(defaultTeeId(tees, null)).toBe("white");
		expect(defaultTeeId(tees, undefined)).toBe("white");
		expect(defaultTeeId(tees, "retired")).toBe("white");
	});

	it("has no default on a course without tees", () => {
		expect(defaultTeeId([], "yellow")).toBeNull();
	});
});

describe("teeLengthMeters", () => {
	const holes = [
		{ ref: "1", lengthMeters: 300, lengths: { white: 320, red: 280 } },
		{ ref: "2", lengthMeters: 150 },
		{ ref: "3" },
	];

	it("sums each hole's length for the tee's marker, else its own length", () => {
		expect(teeLengthMeters({ marker: "white" }, holes, ["1", "2"])).toBe(470);
		expect(teeLengthMeters({ marker: "red" }, holes, ["1", "2"])).toBe(430);
		expect(teeLengthMeters({}, holes, ["1", "2"])).toBe(450);
	});

	it("counts a loop played twice twice", () => {
		expect(teeLengthMeters({ marker: "white" }, holes, ["1", "1"])).toBe(640);
	});

	it("is unknown when a hole has no length or nothing is selected", () => {
		expect(teeLengthMeters({ marker: "white" }, holes, ["1", "3"])).toBeNull();
		expect(teeLengthMeters({ marker: "white" }, holes, ["9"])).toBeNull();
		expect(teeLengthMeters({ marker: "white" }, holes, [])).toBeNull();
	});
});

describe("visibleTees", () => {
	const few = [{ _id: "a" }, { _id: "b" }, { _id: "c" }];
	const many = [...few, { _id: "d" }, { _id: "e" }, { _id: "f" }, { _id: "g" }];

	it("shows a short list in full", () => {
		expect(visibleTees(few, "b", false)).toEqual({ rows: few, folded: false });
	});

	it("folds a long list to the chosen tee", () => {
		expect(visibleTees(many, "e", false)).toEqual({
			rows: [{ _id: "e" }],
			folded: true,
		});
		expect(visibleTees(many, null, false).rows).toEqual([{ _id: "a" }]);
	});

	it("shows a long list in full once expanded", () => {
		expect(visibleTees(many, "e", true)).toEqual({ rows: many, folded: false });
	});
});
