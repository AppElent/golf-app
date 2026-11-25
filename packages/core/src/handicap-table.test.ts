import { describe, expect, it } from "vitest";
import { handicapTable } from "./handicap-table";

const eighteen = Array.from({ length: 18 }, (_, i) => ({
	ref: String(i + 1),
	par: 4,
	strokeIndex: ((i * 7) % 18) + 1,
}));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const column = (
	rows: ReturnType<typeof handicapTable>,
	player: number,
): number[] => rows?.map((row) => row.strokes[player]) ?? [];

describe("handicapTable", () => {
	it("lists every hole in play order with each player's strokes", () => {
		const rows = handicapTable(eighteen, [
			{ playingHandicap: 14 },
			{ playingHandicap: 19 },
		]);
		expect(rows).toHaveLength(18);
		// SI 1: both players get a stroke, the 19 gets a second one.
		expect(rows?.[0]).toEqual({
			hole: "1",
			par: 4,
			strokeIndex: 1,
			strokes: [1, 2],
		});
		expect(sum(column(rows, 0))).toBe(14);
		expect(sum(column(rows, 1))).toBe(19);
	});

	it("gives strokes back on the highest indexes for a plus handicap", () => {
		const rows = handicapTable(eighteen, [{ playingHandicap: -2 }]);
		const back = rows?.filter((row) => row.strokes[0] !== 0);
		expect(back?.map((row) => row.strokeIndex).sort()).toEqual([17, 18]);
		expect(column(back ?? null, 0)).toEqual([-1, -1]);
	});

	it("gives a player without a handicap no strokes", () => {
		expect(sum(column(handicapTable(eighteen, [{}]), 0))).toBe(0);
	});

	it("allocates a nine, and a loop played twice, over the round's own holes", () => {
		const nine = [1, 7, 15, 3, 11, 5, 17, 9, 13].map((strokeIndex, i) => ({
			ref: `(${i + 1})`,
			par: 3,
			strokeIndex,
		}));
		const once = handicapTable(nine, [{ playingHandicap: 9 }]);
		expect(column(once, 0)).toEqual(Array(9).fill(1));
		const twice = handicapTable([...nine, ...nine], [{ playingHandicap: 18 }]);
		expect(column(twice, 0)).toEqual(Array(18).fill(1));
	});

	it.each([undefined, 0])(
		"has no table when a stroke index is %s",
		(strokeIndex) => {
			const holes = eighteen.map((hole, i) =>
				i === 4 ? { ...hole, strokeIndex } : hole,
			);
			expect(handicapTable(holes, [{ playingHandicap: 9 }])).toBeNull();
		},
	);

	it("has no table without stroke indexes or without holes", () => {
		const bare = eighteen.map(({ ref, par }) => ({ ref, par }));
		expect(handicapTable(bare, [{}])).toBeNull();
		expect(handicapTable([], [{}])).toBeNull();
	});
});
