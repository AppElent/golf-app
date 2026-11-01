import { describe, expect, it } from "vitest";
import {
	formatDistance,
	formatTravelDistance,
	holeLabel,
	metersToYards,
} from "./format";

describe("metersToYards", () => {
	it("converts with the standard 1.09361 factor", () => {
		expect(metersToYards(100)).toBeCloseTo(109.361, 2);
	});
});

describe("formatDistance", () => {
	it("rounds meters and appends the unit", () => {
		expect(formatDistance(149.6, "m")).toBe("150 m");
	});

	it("converts to yards when units are yd", () => {
		expect(formatDistance(150, "yd")).toBe("164 yd");
	});

	it("shows an em dash for null", () => {
		expect(formatDistance(null, "m")).toBe("—");
	});
});

describe("formatTravelDistance", () => {
	it("rounds to tens of meters, then km, then whole km", () => {
		expect(formatTravelDistance(844, "m")).toBe("840 m");
		expect(formatTravelDistance(4321, "m")).toBe("4.3 km");
		expect(formatTravelDistance(23_600, "m")).toBe("24 km");
	});
	it("uses miles in yard mode", () => {
		expect(formatTravelDistance(1609.344 * 3.25, "yd")).toBe("3.3 mi");
		expect(formatTravelDistance(1609.344 * 42, "yd")).toBe("42 mi");
	});
});

describe("holeLabel", () => {
	it("strips the parentheses of a second course's refs", () => {
		expect(holeLabel("(6)")).toBe("6");
		expect(holeLabel("10")).toBe("10");
	});
});
