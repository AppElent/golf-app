import { describe, expect, it } from "vitest";
import {
	carryDistances,
	distancesToGreen,
	haversineMeters,
	polygonCentroid,
	projectToLocal,
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
