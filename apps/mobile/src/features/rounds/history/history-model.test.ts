import { groupByMonth } from "./history-model";

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
