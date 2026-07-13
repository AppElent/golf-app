import { describe, expect, it } from "vitest";
import {
	adjustedGrossScore,
	courseHandicap,
	playingHandicap,
	scoreDifferential,
	wouldBeIndex,
	wouldBeIndexHistory,
} from "./handicap";

describe("courseHandicap / playingHandicap", () => {
	it("applies the WHS formula HI × slope/113 + (CR − par)", () => {
		expect(courseHandicap(11.5, 132, 72.1, 72)).toBeCloseTo(13.53, 1);
	});

	it("rounds playing handicap to the nearest integer", () => {
		expect(playingHandicap(11.5, 132, 72.1, 72)).toBe(14);
	});

	it("supports an allowance factor", () => {
		expect(playingHandicap(11.5, 132, 72.1, 72, 0.95)).toBe(13);
	});
});

describe("adjustedGrossScore", () => {
	const holes = [
		{ par: 4, strokeIndex: 10 },
		{ par: 3, strokeIndex: 18 },
	];

	it("caps each hole at net double bogey", () => {
		expect(adjustedGrossScore(holes, [9, 4], 0)).toBe(10);
	});

	it("raises the cap by strokes received", () => {
		expect(adjustedGrossScore(holes, [7, 9], 10)).toBe(12);
	});
});

describe("scoreDifferential", () => {
	it("computes (113/slope) × (AGS − CR) to one decimal", () => {
		expect(scoreDifferential(82, 72.1, 132)).toBeCloseTo(8.5, 5);
	});
});

describe("wouldBeIndex", () => {
	it("returns null with fewer than 3 differentials", () => {
		expect(wouldBeIndex([8.5, 10.1])).toBeNull();
	});

	it("uses lowest 1 minus 2.0 at exactly 3 differentials", () => {
		expect(wouldBeIndex([8.5, 10.2, 12.0])).toBeCloseTo(6.5, 5);
	});

	it("uses average of lowest 2 minus 1.0 at 6 differentials", () => {
		expect(wouldBeIndex([12, 9, 14, 8, 11, 10])).toBeCloseTo(7.5, 5);
	});

	it("averages the best 8 of the most recent 20", () => {
		const diffs = Array.from({ length: 20 }, (_, i) => i + 1);
		expect(wouldBeIndex(diffs)).toBeCloseTo(4.5, 5);
	});

	it("only looks at the most recent 20", () => {
		const old = [0, 0, 0, 0, 0];
		const recent = Array.from({ length: 20 }, (_, i) => i + 1);
		expect(wouldBeIndex([...old, ...recent])).toBeCloseTo(4.5, 5);
	});
});

describe("wouldBeIndexHistory", () => {
	it("is empty until three differentials exist", () => {
		expect(wouldBeIndexHistory([])).toEqual([]);
		expect(wouldBeIndexHistory([10, 12])).toEqual([]);
	});

	it("emits the running index from the third round on", () => {
		const history = wouldBeIndexHistory([20, 18, 22, 16]);
		// One point per round once >= 3 differentials are available.
		expect(history).toHaveLength(2);
		// Each entry matches wouldBeIndex over that prefix.
		expect(history[0]).toBe(wouldBeIndex([20, 18, 22]));
		expect(history[1]).toBe(wouldBeIndex([20, 18, 22, 16]));
	});
});
