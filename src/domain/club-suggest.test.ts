import { describe, expect, it } from "vitest";
import { suggestClub } from "./club-suggest";

const bag = [
	{ name: "Driver", carryMeters: 220 },
	{ name: "5i", carryMeters: 170 },
	{ name: "7i", carryMeters: 150 },
	{ name: "PW", carryMeters: 110 },
];

describe("suggestClub", () => {
	it("picks the club with carry nearest the target", () => {
		expect(suggestClub(bag, 148)?.name).toBe("7i");
		expect(suggestClub(bag, 200)?.name).toBe("Driver");
	});

	it("prefers the longer club on an exact tie", () => {
		expect(suggestClub(bag, 160)?.name).toBe("5i");
	});

	it("returns null for an empty bag", () => {
		expect(suggestClub([], 150)).toBeNull();
	});
});
