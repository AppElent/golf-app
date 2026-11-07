import { describe, expect, it } from "vitest";
import {
	formatVsPar,
	nineTotals,
	scoreMark,
	stablefordPoints,
	stablefordTotal,
	strokesPerHole,
	strokesReceived,
	totalStrokes,
	vsPar,
} from "./scoring";

describe("strokesReceived", () => {
	it("gives one stroke on the lowest-SI holes for a single-digit handicap", () => {
		expect(strokesReceived(1, 11, 18)).toBe(1);
		expect(strokesReceived(11, 11, 18)).toBe(1);
		expect(strokesReceived(12, 11, 18)).toBe(0);
		expect(strokesReceived(18, 11, 18)).toBe(0);
	});

	it("gives a stroke on every hole plus extras when handicap exceeds 18", () => {
		expect(strokesReceived(6, 24, 18)).toBe(2);
		expect(strokesReceived(7, 24, 18)).toBe(1);
		expect(strokesReceived(18, 24, 18)).toBe(1);
	});

	it("gives no strokes at scratch", () => {
		expect(strokesReceived(1, 0, 18)).toBe(0);
	});

	it("takes strokes back on the highest-SI holes for plus handicaps", () => {
		expect(strokesReceived(18, -2, 18)).toBe(-1);
		expect(strokesReceived(17, -2, 18)).toBe(-1);
		expect(strokesReceived(16, -2, 18)).toBe(0);
	});
});

describe("strokesReceived over 9 holes", () => {
	it("cycles every 9 holes", () => {
		expect(strokesReceived(1, 10, 9)).toBe(2);
		expect(strokesReceived(2, 10, 9)).toBe(1);
		expect(strokesReceived(9, -1, 9)).toBe(-1);
	});
});

describe("strokesPerHole", () => {
	const front = [1, 7, 15, 3, 11, 5, 17, 9, 13].map((strokeIndex) => ({
		strokeIndex,
	}));

	it("allocates a 9-hole loop by rank within the loop", () => {
		// A front nine with the card's odd SIs: 9 strokes = one per hole.
		expect(strokesPerHole(front, 9)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
		// 4 strokes go to the four hardest holes (SI 1, 3, 5, 7).
		expect(strokesPerHole(front, 4)).toEqual([1, 1, 0, 1, 0, 1, 0, 0, 0]);
	});

	it("matches the card's stroke index on a full 18", () => {
		const eighteen = Array.from({ length: 18 }, (_, i) => ({
			strokeIndex: 18 - i,
		}));
		expect(strokesPerHole(eighteen, 11)).toEqual(
			eighteen.map((h) => strokesReceived(h.strokeIndex, 11, 18)),
		);
	});
});

describe("stablefordPoints", () => {
	const par4 = { par: 4 };

	it("scores the standard table without strokes", () => {
		expect(stablefordPoints(par4, 2, 0)).toBe(4);
		expect(stablefordPoints(par4, 3, 0)).toBe(3);
		expect(stablefordPoints(par4, 4, 0)).toBe(2);
		expect(stablefordPoints(par4, 5, 0)).toBe(1);
		expect(stablefordPoints(par4, 6, 0)).toBe(0);
		expect(stablefordPoints(par4, 9, 0)).toBe(0);
	});

	it("adds received strokes", () => {
		expect(stablefordPoints(par4, 5, 1)).toBe(2);
		expect(stablefordPoints(par4, 6, 2)).toBe(2);
	});

	it("scores 0 for a hole not played (null / NR)", () => {
		expect(stablefordPoints(par4, null, 1)).toBe(0);
	});
});

describe("stablefordTotal", () => {
	it("allocates strokes over the round's own holes", () => {
		// Two par 4s with card SIs 10 and 12, playing handicap 1: the stroke
		// goes to SI 10, the harder of the two.
		const holes = [
			{ par: 4, strokeIndex: 12 },
			{ par: 4, strokeIndex: 10 },
		];
		expect(stablefordTotal(holes, [5, 5], 1)).toBe(1 + 2);
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
		expect(formatVsPar(-2)).toBe("−2");
		expect(formatVsPar(5.2)).toBe("+5.2");
		expect(formatVsPar(1, 1)).toBe("+1.0");
		expect(formatVsPar(-0.04, 1)).toBe("E");
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

describe("nineTotals", () => {
	it("sums 18 holes into Out/In nines", () => {
		const strokes = [4, 5, 3, 4, 4, 5, 4, 3, 5, 4, 4, 6, 3, 5, 4, 4, 5, 4];
		expect(nineTotals(strokes)).toEqual([37, 39]);
	});
	it("treats null (unplayed) as 0 and handles 9-hole rounds", () => {
		expect(nineTotals([4, null, 5])).toEqual([9]);
	});
});
