import { describe, expect, it } from "vitest";
import oosterhoutse from "./__fixtures__/oosterhoutse.overpass.json";
import welderen from "./__fixtures__/welderen.overpass.json";
import { detectLoops } from "./loops";
import { normalizeCourse } from "./osm";

const holesOf = (fixture: { elements: unknown[] }) =>
	normalizeCourse(
		fixture.elements as Parameters<typeof normalizeCourse>[0],
	).holes.map((h) => ({ ref: h.ref, number: h.number }));

describe("detectLoops", () => {
	it("splits plain 1–18 into two loops and parenthesized refs into their own", () => {
		const loops = detectLoops([
			...Array.from({ length: 18 }, (_, i) => ({
				ref: `${i + 1}`,
				number: i + 1,
			})),
			...Array.from({ length: 9 }, (_, i) => ({
				ref: `(${i + 1})`,
				number: i + 1,
			})),
		]);
		expect(loops.map((l) => l.label)).toEqual(["1–9", "10–18", "(1)–(9)"]);
		expect(loops[0].refs).toEqual([
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
			"9",
		]);
		expect(loops[2].refs[0]).toBe("(1)");
		expect(loops[2].refs).toHaveLength(9);
	});

	it("orders refs numerically within a loop regardless of input order", () => {
		const loops = detectLoops([
			{ ref: "3", number: 3 },
			{ ref: "1", number: 1 },
			{ ref: "2", number: 2 },
		]);
		expect(loops).toHaveLength(1);
		expect(loops[0].refs).toEqual(["1", "2", "3"]);
		expect(loops[0].label).toBe("1–3");
	});

	it("finds three 9-hole loops at Welderen (real data)", () => {
		const loops = detectLoops(holesOf(welderen));
		expect(loops).toHaveLength(3);
		expect(loops.every((l) => l.refs.length === 9)).toBe(true);
	});

	it("finds three 9-hole loops at De Oosterhoutse (real data)", () => {
		const loops = detectLoops(holesOf(oosterhoutse));
		expect(loops).toHaveLength(3);
		expect(loops.every((l) => l.refs.length === 9)).toBe(true);
	});
});
