import { describe, expect, it } from "vitest";
import oosterhoutse from "./__fixtures__/oosterhoutse.overpass.json";
import welderen from "./__fixtures__/welderen.overpass.json";
import {
	centroid,
	lineLengthMeters,
	normalizeCourse,
	parseHoleRef,
	parsePar,
	parseStrokeIndex,
} from "./osm";

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

describe("parsePar", () => {
	it("parses a par tag", () => {
		expect(parsePar({ golf: "hole", par: "4" })).toBe(4);
	});
	it("returns null when absent", () => {
		expect(parsePar({ golf: "hole" })).toBeNull();
	});
});

describe("parseStrokeIndex", () => {
	it("reads golf:stroke_index", () => {
		expect(parseStrokeIndex({ "golf:stroke_index": "7" })).toBe(7);
	});
	it("reads handicap and takes the first of a dual value", () => {
		expect(parseStrokeIndex({ handicap: "11;12" })).toBe(11);
	});
	it("prefers golf:stroke_index over handicap", () => {
		expect(parseStrokeIndex({ "golf:stroke_index": "5", handicap: "9" })).toBe(
			5,
		);
	});
	it("returns null when absent", () => {
		expect(parseStrokeIndex({ golf: "hole" })).toBeNull();
	});
});

describe("lineLengthMeters", () => {
	it("sums haversine over a polyline (~0.001° lat ≈ 111 m per step)", () => {
		const len = lineLengthMeters([
			{ lat: 0, lng: 0 },
			{ lat: 0.001, lng: 0 },
			{ lat: 0.002, lng: 0 },
		]);
		expect(len).toBeCloseTo(222.4, 0);
	});
	it("is 0 for a single point", () => {
		expect(lineLengthMeters([{ lat: 5, lng: 5 }])).toBe(0);
	});
});

describe("centroid", () => {
	it("averages vertices", () => {
		const c = centroid([
			{ lat: 0, lng: 0 },
			{ lat: 2, lng: 0 },
			{ lat: 1, lng: 3 },
		]);
		expect(c.lat).toBeCloseTo(1, 6);
		expect(c.lng).toBeCloseTo(1, 6);
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
	it("has null par (Welderen is not par-tagged in OSM)", () => {
		expect(course.holes.every((h) => h.par === null)).toBe(true);
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
	it("reads par from OSM tags", () => {
		expect(course.holes.some((h) => h.par !== null)).toBe(true);
	});
	it("reads stroke index (first value of dual '11;12')", () => {
		expect(course.holes.some((h) => h.strokeIndex !== null)).toBe(true);
	});
	it("assigns bunkers and fairways to holes", () => {
		const bunkers = course.geometry.reduce((n, g) => n + g.bunkers.length, 0);
		expect(bunkers).toBeGreaterThanOrEqual(20);
	});
});
