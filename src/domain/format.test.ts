import { describe, expect, it } from "vitest";
import { formatDistance, metersToYards } from "./format";

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
