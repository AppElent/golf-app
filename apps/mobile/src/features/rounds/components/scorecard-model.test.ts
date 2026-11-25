import { cardRows } from "./scorecard-model";

describe("cardRows", () => {
	const holes = Array.from({ length: 18 }, (_, i) => ({
		ref: String(i + 1),
		par: 4,
		strokeIndex: i + 1,
	}));

	it("splits Out / In and scores to par over played holes only", () => {
		const [row] = cardRows(
			holes,
			[
				{ holeIndex: 0, playerIndex: 0, strokes: 3 },
				{ holeIndex: 9, playerIndex: 0, strokes: 6 },
			],
			[holes.map(() => 0)],
		);
		expect(row.nines).toEqual([3, 6]);
		expect(row.total).toBe(9);
		expect(row.toPar).toBe("+1");
		expect(row.cells[0].mark).toBe("birdie");
		expect(row.scored).toBe(2);
		expect(row.points).toBe(3 + 0);
	});

	it("shows a pick-up as no score", () => {
		const [row] = cardRows(
			holes.slice(0, 9),
			[{ holeIndex: 0, playerIndex: 0, strokes: 9, nr: true }],
			[holes.map(() => 0)],
		);
		expect(row.cells[0]).toMatchObject({ strokes: null, mark: null, nr: true });
		expect(row.nines).toEqual([0]);
		expect(row.toPar).toBeNull();
	});

	it("marks a player skipped on a played hole (APP-894)", () => {
		const [own, guest] = cardRows(
			holes,
			[
				{ holeIndex: 0, playerIndex: 0, strokes: 4 },
				{ holeIndex: 1, playerIndex: 0, strokes: 4 },
				{ holeIndex: 1, playerIndex: 1, nr: true },
				// Undone pick-up: a row without a result.
				{ holeIndex: 2, playerIndex: 0, strokes: 4 },
				{ holeIndex: 2, playerIndex: 1, nr: false },
			],
			[holes.map(() => 0), holes.map(() => 0)],
		);
		const missing = (row: typeof own) =>
			row.cells.flatMap((c, i) => (c.missing ? [i] : []));
		expect(missing(guest)).toEqual([0, 2]);
		expect(missing(own)).toEqual([]);
	});
});
