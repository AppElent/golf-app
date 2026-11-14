import { describe, expect, it } from "vitest";
import {
	DEFAULT_BAG,
	effectiveBag,
	missingDefaults,
	suggestClub,
} from "./club-suggest";

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
		expect(suggestClub([...bag].reverse(), 160)?.name).toBe("5i");
	});

	it("returns null for an empty bag", () => {
		expect(suggestClub([], 150)).toBeNull();
	});
});

describe("effectiveBag", () => {
	const sevenIron = { name: "7 iron", carryMeters: 145 };

	it("uses the default bag for an empty bag", () => {
		expect(effectiveBag([], DEFAULT_BAG)).toEqual(DEFAULT_BAG);
	});

	it("keeps every user club and fills only uncovered ±10 m bands", () => {
		const bag = effectiveBag([sevenIron], DEFAULT_BAG);
		expect(bag).toContainEqual(sevenIron);
		// 7i (150) and 8i (140) are within 10 m of the user's 145.
		expect(bag.map((c) => c.name)).not.toContain("7i");
		expect(bag.map((c) => c.name)).not.toContain("8i");
		expect(bag.map((c) => c.name)).toContain("Driver");
		expect(bag.map((c) => c.name)).toContain("6i");
		expect(bag).toHaveLength(DEFAULT_BAG.length - 1);
		// Longest first.
		expect(bag[0].name).toBe("Driver");
		expect(suggestClub(bag, 230)?.name).toBe("Driver");
		expect(suggestClub(bag, 146)?.name).toBe("7 iron");
	});

	it("keeps a user club over a default of the same name", () => {
		const bag = effectiveBag([{ name: "Driver", carryMeters: 260 }]);
		expect(bag.filter((c) => c.name === "Driver")).toEqual([
			{ name: "Driver", carryMeters: 260 },
		]);
	});

	it("adds nothing once the user has 8 or more clubs", () => {
		const eight = Array.from({ length: 8 }, (_, i) => ({
			name: `c${i}`,
			carryMeters: 100 + i,
		}));
		expect(effectiveBag(eight, DEFAULT_BAG)).toEqual(eight);
		expect(effectiveBag(eight.slice(0, 7), DEFAULT_BAG).length).toBeGreaterThan(
			7,
		);
	});
});

describe("missingDefaults", () => {
	it("lists the defaults a bag lacks by name or carry", () => {
		expect(missingDefaults(DEFAULT_BAG, DEFAULT_BAG)).toEqual([]);
		expect(
			missingDefaults([{ name: "driver", carryMeters: 300 }], DEFAULT_BAG).map(
				(c) => c.name,
			),
		).not.toContain("Driver");
	});
});
