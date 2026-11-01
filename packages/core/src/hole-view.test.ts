import { describe, expect, it } from "vitest";
import { greenNumbers, hazardsInPlay, holeAnchors } from "./hole-view";

// A hole running due north: tee at 0, green ~330 m north (0.003°).
const p = (dLat: number, dLng = 0) => ({ lat: 52 + dLat, lng: 5.9 + dLng });
const square = (dLat: number, dLng: number, r = 0.0001) => [
	p(dLat - r, dLng - r),
	p(dLat - r, dLng + r),
	p(dLat + r, dLng + r),
	p(dLat + r, dLng - r),
];
const geo = {
	holeLine: [p(0), p(0.003)],
	tees: [square(0, 0)],
	greens: [square(0.003, 0, 0.0001)],
	fairways: [],
	bunkers: [square(0.0018, 0.0002), square(0.0034, 0)],
	water: [square(0.0025, -0.0003), square(-0.0005, 0)],
};

describe("holeAnchors", () => {
	it("uses tee box and green centroids", () => {
		const a = holeAnchors(geo);
		expect(a?.tee.lat).toBeCloseTo(52, 6);
		expect(a?.green.lat).toBeCloseTo(52.003, 6);
		expect(a?.greenRing).toHaveLength(4);
	});
	it("falls back to the hole line, and to null", () => {
		const a = holeAnchors({ ...geo, tees: [], greens: [] });
		expect(a?.tee).toEqual(p(0));
		expect(a?.green).toEqual(p(0.003));
		expect(a?.greenRing).toBeNull();
		expect(
			holeAnchors({ ...geo, holeLine: [], tees: [], greens: [] }),
		).toBeNull();
	});
});

describe("hazardsInPlay", () => {
	it("keeps hazards ahead of you and short of the green, nearest first", () => {
		const hazards = hazardsInPlay(p(0), p(0.003), geo);
		expect(hazards.map((h) => h.kind)).toEqual(["bunker", "water"]);
		expect(hazards[0].reach).toBeLessThan(hazards[0].carry);
		expect(Math.round(hazards[0].reach)).toBeGreaterThan(185);
	});
	it("drops hazards out of range", () => {
		expect(hazardsInPlay(p(0), p(0.003), geo, { maxMeters: 150 })).toEqual([]);
	});
});

describe("greenNumbers", () => {
	it("gives front < center < back to a polygon, center-only to a point", () => {
		const a = holeAnchors(geo);
		if (!a) throw new Error("no anchors");
		const n = greenNumbers(p(0), a);
		expect(n.front).toBeLessThan(n.center);
		expect(n.back).toBeGreaterThan(n.center);
		const bare = greenNumbers(p(0), { ...a, greenRing: null });
		expect(bare.front).toBe(bare.back);
	});
});
