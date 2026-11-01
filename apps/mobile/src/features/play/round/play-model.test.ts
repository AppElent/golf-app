import { haversineMeters } from "@fairway/core/geo";
import {
	defaultTarget,
	distanceNumber,
	isOnHole,
	legLabel,
} from "./play-model";

const tee = { lat: 52, lng: 5.9 };
const green = { lat: 52.004, lng: 5.9 }; // ~445 m
const bag = [
	{ name: "Driver", carryMeters: 230 },
	{ name: "7i", carryMeters: 150 },
];

describe("play model", () => {
	it("lays up at the longest club on a long hole, else targets the green", () => {
		const t = defaultTarget(tee, green, bag);
		expect(haversineMeters(tee, t)).toBeCloseTo(230, 0);
		const near = { lat: 52.0025, lng: 5.9 };
		expect(defaultTarget(near, green, bag)).toEqual(green);
		expect(defaultTarget(tee, green, [])).toEqual(green);
	});

	it("formats numbers in units and adds the club for the first leg", () => {
		expect(distanceNumber(150, "m")).toBe("150");
		expect(distanceNumber(150, "yd")).toBe("164");
		expect(legLabel(148, "m", bag, true)).toBe("148 · 7i");
		expect(legLabel(148, "m", bag, false)).toBe("148");
	});
});

describe("isOnHole", () => {
	const anchors = { tee: { lat: 52, lng: 5 }, green: { lat: 52.0036, lng: 5 } }; // ~400 m
	it("counts a fix on or beside the hole", () => {
		expect(isOnHole({ lat: 52.001, lng: 5.001 }, anchors)).toBe(true);
		expect(isOnHole({ lat: 51.9995, lng: 5 }, anchors)).toBe(true);
	});
	it("ignores a fix two holes away", () => {
		expect(isOnHole({ lat: 51.996, lng: 5 }, anchors)).toBe(false);
	});
});
