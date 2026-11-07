import { describe, expect, it } from "vitest";
import { roundRecap } from "./recap";

const nine = Array.from({ length: 9 }, (_, i) => ({
	par: i === 2 ? 3 : 4,
	strokeIndex: i + 1,
}));

describe("roundRecap", () => {
	it("counts marks, nets the playing handicap and finds the holes", () => {
		// par 35; strokes 40 → +5
		const strokes = [3, 4, 3, 5, 5, 4, 7, 4, 5];
		const r = roundRecap(nine, strokes, 5);
		expect(r.marks).toEqual({
			eagle: 0,
			birdie: 1,
			par: 4,
			bogey: 3,
			double: 1,
		});
		expect(r.net).toBe(35);
		expect(r.netToPar).toBe(0);
		expect(r.best).toEqual({ holeIndex: 0, toPar: -1 });
		// Hole 7 (+3, SI 7, no stroke received at PH 5) costs most net.
		expect(r.toughest).toEqual({ holeIndex: 6, toPar: 3 });
		expect(r.nines).toEqual([{ strokes: 40, toPar: 5, complete: true }]);
	});

	it("leaves net out while holes are missing or picked up", () => {
		const r = roundRecap(nine, [4, 4, null, 4], 5);
		expect(r.net).toBeNull();
		expect(r.scored).toBe(3);
		expect(r.nines[0]).toEqual({ strokes: 12, toPar: 0, complete: false });
		const pickedUp = roundRecap(nine, [null, 4, 3, 4, 4, 4, 4, 4, 4], 5);
		expect(pickedUp.net).toBeNull();
		expect(pickedUp.netToPar).toBeNull();
	});

	it("has no toughest hole when every hole is net par or better", () => {
		const r = roundRecap(nine, [5, 5, 4, 5, 5, 4, 4, 4, 4], 9);
		expect(r.toughest).toBeNull();
	});

	it("splits 18 holes into two nines", () => {
		const r = roundRecap([...nine, ...nine], Array(18).fill(4), undefined);
		expect(r.nines).toHaveLength(2);
		expect(r.net).toBeNull();
	});
});
