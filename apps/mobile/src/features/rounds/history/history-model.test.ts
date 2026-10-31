import { groupByMonth, ownerRoundStats, scoreLabel } from "./history-model";

const at = (y: number, m: number, d: number) => new Date(y, m, d, 10).getTime();

describe("groupByMonth", () => {
	it("starts a section whenever the month changes", () => {
		const rounds = [
			{
				_id: "a",
				startedAt: at(2026, 9, 20),
				owner: { strokes: 90, vsPar: 18 },
			},
			{
				_id: "b",
				startedAt: at(2026, 9, 2),
				owner: { strokes: 88, vsPar: 16 },
			},
			{ _id: "c", startedAt: at(2026, 8, 30), owner: { strokes: 0, vsPar: 0 } },
		];
		const sections = groupByMonth(rounds, "en-GB");
		expect(sections.map((s) => s.rounds.map((r) => r._id))).toEqual([
			["a", "b"],
			["c"],
		]);
		expect(sections[0].title).toBe("October 2026");
	});
});

describe("scoreLabel", () => {
	it("reads strokes with the score to par", () => {
		expect(scoreLabel({ strokes: 84, vsPar: 12 })).toBe("84 (+12)");
	});
	it("is empty for a round without strokes", () => {
		expect(scoreLabel({ strokes: 0, vsPar: 0 })).toBeUndefined();
	});
});

describe("ownerRoundStats", () => {
	const holes = [{ par: 4 }, { par: 3 }, { par: 5 }];
	it("counts the owner's recorded putts, fairways (par 4+) and greens", () => {
		const stats = ownerRoundStats(holes, [
			{ holeIndex: 0, playerIndex: 0, putts: 2, fir: true, gir: false },
			{ holeIndex: 1, playerIndex: 0, putts: 1, fir: true, gir: true },
			{ holeIndex: 2, playerIndex: 0, fir: false },
			{ holeIndex: 0, playerIndex: 1, putts: 3, fir: true },
		]);
		expect(stats).toEqual({
			putts: 3,
			fairways: { hit: 1, of: 2 },
			greens: { hit: 1, of: 2 },
		});
	});
	it("is empty where nothing was recorded", () => {
		expect(ownerRoundStats(holes, [])).toEqual({
			putts: null,
			fairways: null,
			greens: null,
		});
	});
});
