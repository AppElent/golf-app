import { describe, expect, it } from "vitest";
import {
	adjustedGrossScore,
	courseHandicap,
	expectedNineHoleDifferential,
	formatHandicapIndex,
	parseHandicapIndex,
	playingHandicap,
	playingHandicapPreview,
	ratedHoles,
	roundDifferential,
	roundPlayingHandicap,
	scoreDifferential,
	wouldBeFromHistory,
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
});

describe("roundPlayingHandicap", () => {
	const eighteenHoleTee = { courseRating: 71.8, slopeRating: 129 };
	const nineHoleTee = { courseRating: 26.7, slopeRating: 84 };

	it("tells 9-hole from 18-hole ratings", () => {
		expect(ratedHoles(71.8)).toBe(18);
		expect(ratedHoles(26.7)).toBe(9);
	});

	it("is the plain playing handicap for 18 holes", () => {
		expect(roundPlayingHandicap(18, eighteenHoleTee, 72, 18)).toBe(
			playingHandicap(18, 129, 71.8, 72),
		);
	});

	it("halves index and rating for one nine of an 18-hole course", () => {
		// 9 × 129/113 + (35.9 − 36) = 10.17 → 10 (not 18-hole CR minus 9-hole par)
		expect(roundPlayingHandicap(18, eighteenHoleTee, 36, 9)).toBe(10);
	});

	it("halves the index on a 9-hole-rated course", () => {
		// 9 × 84/113 + (26.7 − 27) = 6.39 → 6
		expect(roundPlayingHandicap(18, nineHoleTee, 27, 9)).toBe(6);
	});

	it("doubles a 9-hole rating when the loop is played twice", () => {
		// 18 × 84/113 + (53.4 − 54) = 12.78 → 13
		expect(roundPlayingHandicap(18, nineHoleTee, 54, 18)).toBe(13);
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

	it("raises the cap by strokes received over the round's holes", () => {
		// Handicap 3 over two holes: SI 10 gets 2, SI 18 gets 1.
		expect(adjustedGrossScore(holes, [9, 9], 3)).toBe(8 + 6);
	});
});

describe("scoreDifferential", () => {
	it("computes (113/slope) × (AGS − CR) to one decimal", () => {
		expect(scoreDifferential(82, 72.1, 132)).toBeCloseTo(8.5, 5);
	});
});

describe("roundDifferential", () => {
	const nine = Array.from({ length: 9 }, (_, i) => ({
		par: 4,
		strokeIndex: i * 2 + 1,
	}));
	const tee = { courseRating: 72, slopeRating: 113 };

	it("18 holes: the plain differential on the full rating", () => {
		const holes = [...nine, ...nine];
		expect(
			roundDifferential({
				holes,
				strokes: holes.map(() => 5),
				playingHandicap: 18,
				tee,
			}),
		).toBe(18);
	});

	it("9 holes: half rating plus the expected 9-hole differential", () => {
		// 45 on CR 36 / slope 113 = 9.0, plus expected for 14.0 = 8.5.
		expect(expectedNineHoleDifferential(14)).toBe(8.5);
		expect(
			roundDifferential({
				holes: nine,
				strokes: nine.map(() => 5),
				playingHandicap: 7,
				handicapIndex: 14,
				tee,
			}),
		).toBe(17.5);
	});

	it("9 holes on a 9-hole rating use it as is", () => {
		expect(
			roundDifferential({
				holes: nine,
				strokes: nine.map(() => 5),
				playingHandicap: 7,
				handicapIndex: 14,
				tee: { courseRating: 36, slopeRating: 113 },
			}),
		).toBe(17.5);
	});

	it("is null with a missing stroke, an odd hole count or no index on 9", () => {
		const base = { playingHandicap: 7, tee };
		expect(
			roundDifferential({
				...base,
				holes: nine,
				strokes: [...nine.map(() => 5).slice(1), null],
				handicapIndex: 14,
			}),
		).toBeNull();
		expect(
			roundDifferential({
				...base,
				holes: nine.slice(0, 6),
				strokes: [5, 5, 5, 5, 5, 5],
				handicapIndex: 14,
			}),
		).toBeNull();
		expect(
			roundDifferential({ ...base, holes: nine, strokes: nine.map(() => 5) }),
		).toBeNull();
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

describe("parseHandicapIndex", () => {
	it.each([
		["18.4", 18.4],
		["18,4", 18.4],
		[" 7 ", 7],
		["+1.2", -1.2],
		["-1.5", -1.5],
		["54", 54],
		["18,", 18],
		[".5", 0.5],
	])("reads %s", (text, value) => {
		expect(parseHandicapIndex(text)).toEqual({ valid: true, value });
	});
	it("takes blank text as no index", () => {
		expect(parseHandicapIndex("  ")).toEqual({ valid: true, value: null });
	});
	it.each(["55", "18.45", "abc", "+11", "1.2.3", "."])("refuses %s", (text) => {
		expect(parseHandicapIndex(text)).toEqual({ valid: false, value: null });
	});
});

describe("formatHandicapIndex", () => {
	it("writes plus handicaps with a plus", () => {
		expect(formatHandicapIndex(-1.2)).toBe("+1.2");
		expect(formatHandicapIndex(18.4)).toBe("18.4");
	});
});

describe("playingHandicapPreview", () => {
	const tee = { slopeRating: 130, courseRating: 72.1 };
	it("needs a valid index, a tee and a par", () => {
		expect(playingHandicapPreview("18", tee, 72, 18)).toBe(21);
		expect(playingHandicapPreview("abc", tee, 72, 18)).toBeUndefined();
		expect(playingHandicapPreview("18", undefined, 72, 18)).toBeUndefined();
		expect(playingHandicapPreview("18", tee, 0, 0)).toBeUndefined();
		expect(playingHandicapPreview("18", tee, 0, 18)).toBeUndefined();
	});
	it("plays a 9-hole loop off half the index and half the rating", () => {
		// 9 × 130/113 + (36.05 − 36) = 10.4 → 10
		expect(playingHandicapPreview("18", tee, 36, 9)).toBe(10);
	});
});

describe("wouldBeFromHistory", () => {
	it("needs three differentials, skipping rounds that don't count", () => {
		expect(
			wouldBeFromHistory([{ differential: 20 }, { differential: null }]),
		).toEqual({ index: null, counted: 1, trend: [] });
	});
	it("reads history newest first", () => {
		const rounds = [30, 20, null, 10].map((differential) => ({ differential }));
		// Oldest first: 10, 20, 30 → best 1 of 3 minus 2 = 8.
		expect(wouldBeFromHistory(rounds)).toEqual({
			index: 8,
			counted: 3,
			trend: [8],
		});
	});
});
