import { toggleLoopPick } from "./round-setup-model";

describe("toggleLoopPick", () => {
	it("allows at most two picks and restarts on the third", () => {
		expect(toggleLoopPick([], 0)).toEqual([0]);
		expect(toggleLoopPick([0], 0)).toEqual([0, 0]);
		expect(toggleLoopPick([0, 1], 2)).toEqual([2]);
	});
});
