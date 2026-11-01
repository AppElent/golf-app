import { describe, expect, it } from "vitest";
import {
	bearingDegrees,
	carryDistances,
	distancesToGreen,
	haversineMeters,
	interpolate,
	labelSpot,
	polygonCentroid,
	projectToLocal,
	sortByDistance,
} from "./geo";

describe("haversineMeters", () => {
	it("measures 0.001° latitude as ~111.2 m", () => {
		expect(
			haversineMeters({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 }),
		).toBeCloseTo(111.2, 0);
	});

	it("scales longitude by cos(latitude) — ~68.5 m at 52°N", () => {
		expect(
			haversineMeters({ lat: 52, lng: 5.8 }, { lat: 52, lng: 5.801 }),
		).toBeCloseTo(68.5, 0);
	});

	it("is zero for identical points", () => {
		expect(haversineMeters({ lat: 52, lng: 5.8 }, { lat: 52, lng: 5.8 })).toBe(
			0,
		);
	});
});

describe("projectToLocal", () => {
	it("returns meters east (x) and north (y) of the origin", () => {
		const origin = { lat: 52, lng: 5.8 };
		const north = projectToLocal(origin, { lat: 52.001, lng: 5.8 });
		expect(north.x).toBeCloseTo(0, 1);
		expect(north.y).toBeCloseTo(111.2, 0);
		const east = projectToLocal(origin, { lat: 52, lng: 5.801 });
		expect(east.x).toBeCloseTo(68.5, 0);
		expect(east.y).toBeCloseTo(0, 1);
	});
});

describe("polygonCentroid", () => {
	it("averages the vertices", () => {
		const centroid = polygonCentroid([
			{ lat: 0, lng: 0 },
			{ lat: 0.002, lng: 0 },
			{ lat: 0.001, lng: 0.003 },
		]);
		expect(centroid.lat).toBeCloseTo(0.001, 6);
		expect(centroid.lng).toBeCloseTo(0.001, 6);
	});
});

describe("distancesToGreen", () => {
	const player = { lat: 0, lng: 0 };
	const green = [
		{ lat: 0, lng: 0.0009 },
		{ lat: 0, lng: 0.001 },
		{ lat: 0, lng: 0.0011 },
	];

	it("front = nearest vertex, back = farthest, center = centroid", () => {
		const d = distancesToGreen(player, green);
		expect(d.front).toBeCloseTo(100.1, 0);
		expect(d.center).toBeCloseTo(111.2, 0);
		expect(d.back).toBeCloseTo(122.3, 0);
	});

	it("projects onto the player→center axis (a wide side vertex is not 'front')", () => {
		// Player south of a green centered ~111 m north; green is wide east–west.
		// A side vertex is closer as a raw vertex, but front/back are along the axis.
		const playerSouth = { lat: 0, lng: 0 };
		const wideGreen = [
			{ lat: 0.00095, lng: -0.0003 }, // near-left
			{ lat: 0.00105, lng: 0.0003 }, // far-right
			{ lat: 0.001, lng: 0 }, // center-ish
		];
		const d = distancesToGreen(playerSouth, wideGreen);
		expect(d.center).toBeCloseTo(111.2, 0);
		expect(d.front).toBeLessThan(d.center);
		expect(d.back).toBeGreaterThan(d.center);
		expect(d.back - d.front).toBeLessThan(30);
	});
});

describe("carryDistances", () => {
	it("reach = nearest edge, carry = far edge", () => {
		const player = { lat: 0, lng: 0 };
		const water = [
			{ lat: 0, lng: 0.0005 },
			{ lat: 0, lng: 0.0007 },
		];
		const d = carryDistances(player, water);
		expect(d.reach).toBeCloseTo(55.6, 0);
		expect(d.carry).toBeCloseTo(77.8, 0);
	});
});

describe("bearingDegrees", () => {
	it("is 0 due north, 90 due east, 180 south", () => {
		const o = { lat: 52, lng: 5.9 };
		expect(bearingDegrees(o, { lat: 52.01, lng: 5.9 })).toBeCloseTo(0, 3);
		expect(bearingDegrees(o, { lat: 52, lng: 5.91 })).toBeCloseTo(90, 1);
		expect(bearingDegrees(o, { lat: 51.99, lng: 5.9 })).toBeCloseTo(180, 3);
	});
});

describe("sortByDistance", () => {
	it("sorts nearest first and puts unlocated items last", () => {
		const here = { lat: 52, lng: 5.9 };
		const sorted = sortByDistance(
			[
				{ name: "far", location: { lat: 52.1, lng: 5.9 } },
				{ name: "none" },
				{ name: "near", location: { lat: 52.01, lng: 5.9 } },
			],
			here,
		);
		expect(sorted.map((c) => c.name)).toEqual(["near", "far", "none"]);
		expect(sorted[2].distanceMeters).toBeNull();
	});
});

describe("labelSpot", () => {
	const a = { lat: 52, lng: 5 };
	const b = { lat: 52.002, lng: 5 }; // ~222 m north
	it("is midway with nothing to avoid", () => {
		expect(labelSpot(a, b, [])).toEqual(interpolate(a, b, 0.5));
	});
	it("moves off a hazard label at the midpoint", () => {
		const spot = labelSpot(a, b, [interpolate(a, b, 0.5)]);
		expect(
			haversineMeters(spot, interpolate(a, b, 0.5)),
		).toBeGreaterThanOrEqual(30);
	});
	it("keeps the clearest spot when nothing clears", () => {
		const crowd = [0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74].map((t) =>
			interpolate(a, b, t),
		);
		expect(labelSpot(a, b, crowd)).toBeDefined();
	});
});
