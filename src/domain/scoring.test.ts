import { describe, expect, it } from "vitest";
import {
	formatVsPar,
	scoreMark,
	splitTotals,
	stablefordPoints,
	strokesReceived,
	totalStrokes,
	vsPar,
} from "./scoring";

describe("strokesReceived", () => {
	it("gives one stroke on the lowest-SI holes for a single-digit handicap", () => {
		expect(strokesReceived(1, 11)).toBe(1);
		expect(strokesReceived(11, 11)).toBe(1);
		expect(strokesReceived(12, 11)).toBe(0);
		expect(strokesReceived(18, 11)).toBe(0);
	});

	it("gives a stroke on every hole plus extras when handicap exceeds 18", () => {
		expect(strokesReceived(6, 24)).toBe(2);
		expect(strokesReceived(7, 24)).toBe(1);
		expect(strokesReceived(18, 24)).toBe(1);
	});

	it("gives no strokes at scratch", () => {
		expect(strokesReceived(1, 0)).toBe(0);
	});

	it("takes strokes back on the highest-SI holes for plus handicaps", () => {
		expect(strokesReceived(18, -2)).toBe(-1);
		expect(strokesReceived(17, -2)).toBe(-1);
		expect(strokesReceived(16, -2)).toBe(0);
	});
});

describe("stablefordPoints", () => {
	const par4si10 = { par: 4, strokeIndex: 10 };

	it("scores the standard table at scratch", () => {
		expect(stablefordPoints(par4si10, 2, 0)).toBe(4);
		expect(stablefordPoints(par4si10, 3, 0)).toBe(3);
		expect(stablefordPoints(par4si10, 4, 0)).toBe(2);
		expect(stablefordPoints(par4si10, 5, 0)).toBe(1);
		expect(stablefordPoints(par4si10, 6, 0)).toBe(0);
		expect(stablefordPoints(par4si10, 9, 0)).toBe(0);
	});

	it("applies received strokes via stroke index", () => {
		const par4si1 = { par: 4, strokeIndex: 1 };
		expect(stablefordPoints(par4si1, 5, 11)).toBe(2);
		expect(stablefordPoints(par4si10, 5, 11)).toBe(2);
		const par4si12 = { par: 4, strokeIndex: 12 };
		expect(stablefordPoints(par4si12, 5, 11)).toBe(1);
	});

	it("scores 0 for a hole not played (null / NR)", () => {
		expect(stablefordPoints(par4si10, null, 11)).toBe(0);
	});
});

describe("totals", () => {
	it("sums strokes ignoring unplayed holes", () => {
		expect(totalStrokes([4, 5, null, 3])).toBe(12);
	});

	it("computes vs-par over played holes only", () => {
		const holes = [{ par: 4 }, { par: 3 }, { par: 5 }];
		expect(vsPar(holes, [5, 3, null])).toBe(1);
		expect(vsPar(holes, [4, 3, 5])).toBe(0);
	});

	it("formats vs-par golf style", () => {
		expect(formatVsPar(0)).toBe("E");
		expect(formatVsPar(3)).toBe("+3");
		expect(formatVsPar(-2)).toBe("-2");
	});
});

describe("scoreMark", () => {
	it("classifies against par", () => {
		expect(scoreMark(4, 2)).toBe("eagle");
		expect(scoreMark(4, 3)).toBe("birdie");
		expect(scoreMark(4, 4)).toBe("par");
		expect(scoreMark(4, 5)).toBe("bogey");
		expect(scoreMark(4, 6)).toBe("double");
		expect(scoreMark(4, 9)).toBe("double");
	});
	it("returns null when strokes are missing", () => {
		expect(scoreMark(4, null)).toBeNull();
	});
});

describe("splitTotals", () => {
	it("sums 18 holes into Out/In nines", () => {
		const strokes = [4, 5, 3, 4, 4, 5, 4, 3, 5, 4, 4, 6, 3, 5, 4, 4, 5, 4];
		expect(splitTotals(strokes, 9)).toEqual([37, 39]);
	});
	it("treats null (unplayed) as 0 and handles 9-hole rounds", () => {
		expect(splitTotals([4, null, 5], 9)).toEqual([9]);
	});
});
