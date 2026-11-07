import { describe, expect, it } from "vitest";
import oosterhoutse from "./__fixtures__/oosterhoutse.overpass.json";
import welderen from "./__fixtures__/welderen.overpass.json";
import { normalizeCourse, parseHoleRef } from "./osm";

describe("parseHoleRef", () => {
	it("reads a plain number", () => {
		expect(parseHoleRef("10")).toEqual({ number: 10, ref: "10" });
	});
	it("reads a parenthesized loop ref", () => {
		expect(parseHoleRef("(3)")).toEqual({ number: 3, ref: "(3)" });
	});
	it("takes the first integer of a shared ref", () => {
		expect(parseHoleRef("1;10")).toEqual({ number: 1, ref: "1;10" });
	});
	it("returns number 0 when no integer is present", () => {
		expect(parseHoleRef("clubhouse")).toEqual({ number: 0, ref: "clubhouse" });
	});
	it("handles undefined", () => {
		expect(parseHoleRef(undefined)).toEqual({ number: 0, ref: "" });
	});
});

describe("normalizeCourse — Welderen (relation 901850)", () => {
	const course = normalizeCourse(welderen.elements);

	it("extracts at least 27 holes", () => {
		expect(course.holes.length).toBeGreaterThanOrEqual(27);
	});
	it("parses hole numbers from refs", () => {
		expect(course.holes.every((h) => h.number >= 1)).toBe(true);
	});
	it("produces one geometry entry per hole (keyed by ref) and assigns greens", () => {
		expect(course.geometry.length).toBe(course.holes.length);
		const totalGreens = course.geometry.reduce(
			(n, g) => n + g.greens.length,
			0,
		);
		expect(totalGreens).toBeGreaterThanOrEqual(18);
	});
	it("keeps loop holes distinct — '1' and '(1)' are separate holes", () => {
		const refs = course.holes.map((h) => h.ref);
		expect(refs).toContain("1");
		expect(refs).toContain("(1)");
	});
});

describe("normalizeCourse — De Oosterhoutse (relation 4458605)", () => {
	const course = normalizeCourse(oosterhoutse.elements);

	it("extracts at least 27 holes", () => {
		expect(course.holes.length).toBeGreaterThanOrEqual(27);
	});
	it("assigns bunkers and fairways to holes", () => {
		const bunkers = course.geometry.reduce((n, g) => n + g.bunkers.length, 0);
		expect(bunkers).toBeGreaterThanOrEqual(20);
		const fairways = course.geometry.reduce((n, g) => n + g.fairways.length, 0);
		expect(fairways).toBeGreaterThanOrEqual(1);
	});
});

describe("normalizeCourse — green matching", () => {
	// ~0.0005° ≈ 55 m north per step.
	const square = (lat: number, lon: number) =>
		[
			[lat - 0.0001, lon - 0.0001],
			[lat - 0.0001, lon + 0.0001],
			[lat + 0.0001, lon + 0.0001],
			[lat + 0.0001, lon - 0.0001],
			[lat - 0.0001, lon - 0.0001],
		].map(([la, lo]) => ({ lat: la, lon: lo }));
	const hole = (ref: string, from: number, to: number, lon: number) => ({
		type: "way",
		id: Number(ref),
		tags: { golf: "hole", ref },
		geometry: [
			{ lat: from, lon },
			{ lat: to, lon },
		],
	});
	const green = (id: number, lat: number, lon: number) => ({
		type: "way",
		id,
		tags: { golf: "green" },
		geometry: square(lat, lon),
	});

	it("puts the green at the line's end and flips a hole drawn green-to-tee", () => {
		const course = normalizeCourse([
			hole("1", 52.0, 52.003, 5.0),
			hole("2", 52.003, 52.0, 5.01), // drawn backwards
			green(10, 52.003, 5.0),
			green(11, 52.0, 5.01),
		]);
		const byRef = new Map(course.geometry.map((g) => [g.ref, g]));
		expect(byRef.get("1")?.greens).toHaveLength(1);
		expect(byRef.get("2")?.greens).toHaveLength(1);
		expect(byRef.get("2")?.holeLine[0].lat).toBe(52.003);
	});

	it("drops a practice green that no hole ends on", () => {
		const course = normalizeCourse([
			hole("1", 52.0, 52.003, 5.0),
			green(10, 52.003, 5.0),
			green(11, 52.0015, 5.003), // ~200 m beside the fairway
		]);
		expect(course.geometry[0].greens).toHaveLength(1);
	});
});

describe("normalizeCourse — lone pins", () => {
	const hole = (ref: string, from: number, to: number) => ({
		type: "way",
		id: Number(ref),
		tags: { golf: "hole", ref },
		geometry: [
			{ lat: from, lon: 5.0 },
			{ lat: to, lon: 5.0 },
		],
	});
	const pin = (id: number, lat: number) => ({
		type: "node",
		id,
		lat,
		lon: 5.0,
		tags: { golf: "pin" },
	});

	it("draws a stand-in green around a pin at the line's end and flips the line to it", () => {
		const course = normalizeCourse([
			hole("1", 52.003, 52.0), // drawn green-to-tee
			pin(10, 52.003),
		]);
		const g = course.geometry[0];
		expect(g.greens).toHaveLength(1);
		expect(g.greens[0]).toHaveLength(16);
		expect(g.holeLine[g.holeLine.length - 1].lat).toBe(52.003);
	});

	it("ignores a pin far from the line's ends", () => {
		const course = normalizeCourse([hole("1", 52.0, 52.003), pin(10, 52.0015)]);
		expect(course.geometry[0].greens).toHaveLength(0);
	});
});
