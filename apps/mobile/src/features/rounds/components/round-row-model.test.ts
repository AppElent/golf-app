import { scoreLabel } from "./round-row-model";

describe("scoreLabel", () => {
	it("reads strokes with the score to par", () => {
		expect(scoreLabel({ strokes: 84, vsPar: 12 })).toBe("84 (+12)");
	});
	it("is empty for a round without strokes", () => {
		expect(scoreLabel({ strokes: 0, vsPar: 0 })).toBeUndefined();
	});
});
