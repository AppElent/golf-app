import { describe, expect, it } from "vitest";
import { clubDistances, type MarkedShot, shotDistances } from "./shots";

// ~111 m per 0.001° latitude.
const at = (dLat: number) => ({ lat: 52 + dLat, lng: 5.9 });
const shot = (
	holeIndex: number,
	dLat: number,
	markedAt: number,
	club?: string,
	roundId = "r1",
): MarkedShot => ({ roundId, holeIndex, position: at(dLat), club, markedAt });

describe("shotDistances", () => {
	it("measures each shot to the next one on the same hole", () => {
		const d = shotDistances([
			shot(0, 0, 1, "Driver"),
			shot(0, 0.002, 2, "7i"),
			shot(0, 0.0033, 3, "PW"),
		]);
		expect(d.map((x) => Math.round(x.meters))).toEqual([222, 145]);
		expect(d.map((x) => x.shot.club)).toEqual(["Driver", "7i"]);
	});

	it("never measures across holes or rounds, and sorts by time", () => {
		const d = shotDistances([
			shot(0, 0.002, 2, "7i"),
			shot(0, 0, 1, "Driver"),
			shot(1, 0.01, 3, "Driver"),
			shot(0, 0.005, 4, "Driver", "r2"),
		]);
		expect(d).toHaveLength(1);
		expect(d[0].shot.club).toBe("Driver");
	});
});

describe("clubDistances", () => {
	it("aggregates per club, longest first, skipping unlabeled and outliers", () => {
		const result = clubDistances([
			shot(0, 0, 1, "Driver"),
			shot(0, 0.002, 2, "7i"), // driver 222
			shot(0, 0.0033, 3), // 7i 145
			shot(1, 0, 4, "Driver"),
			shot(1, 0.0021, 5), // driver 234
			shot(2, 0, 6, "PW"),
			shot(2, 0.0001, 7), // PW 11 m: too short, ignored
			shot(3, 0, 8),
			shot(3, 0.001, 9), // no club: ignored
		]);
		expect(result.map((r) => r.club)).toEqual(["Driver", "7i"]);
		expect(result[0]).toMatchObject({ shots: 2, medianMeters: 228 });
		expect(result[1]).toMatchObject({ shots: 1, medianMeters: 145 });
	});
});
