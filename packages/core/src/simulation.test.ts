import { describe, expect, it } from "vitest";
import { haversineMeters } from "./geo";
import { simulationSpot, walkStep } from "./simulation";

const p = (dLat: number, dLng = 0) => ({ lat: 52 + dLat, lng: 5.9 + dLng });
const anchors = { tee: p(0), green: p(0.003, 0.002) };
// Up about 334 m, then east about 137 m.
const dogleg = [p(0), p(0.003), p(0.003, 0.002)];

describe("simulationSpot", () => {
	it("jumps to the tee and green", () => {
		expect(simulationSpot("tee", anchors, dogleg)).toEqual(anchors.tee);
		expect(simulationSpot("green", anchors, dogleg)).toEqual(anchors.green);
	});
	it("puts the approach 100 m out on the line of play, past the dogleg", () => {
		const approach = simulationSpot("approach", anchors, dogleg);
		expect(approach.lat).toBeCloseTo(p(0.003).lat, 5);
		expect(haversineMeters(approach, anchors.green)).toBeCloseTo(100, 0);
	});
	it("stays on the tee on a hole shorter than the approach", () => {
		const short = { tee: p(0), green: p(0.0005) };
		expect(simulationSpot("approach", short, undefined)).toEqual(short.tee);
	});
});

describe("walkStep", () => {
	it("walks the line of play around a dogleg", () => {
		const onFirstLeg = walkStep(p(0), anchors.green, dogleg, 50);
		expect(onFirstLeg.lng).toBeCloseTo(p(0).lng, 6);
		expect(haversineMeters(p(0), onFirstLeg)).toBeCloseTo(50, 0);
		const pastCorner = walkStep(p(0.0029), anchors.green, dogleg, 50);
		expect(pastCorner.lat).toBeCloseTo(p(0.003).lat, 5);
		expect(pastCorner.lng).toBeGreaterThan(p(0).lng);
	});
	it("ends on the green", () => {
		let at = p(0);
		for (let i = 0; i < 100; i++) at = walkStep(at, anchors.green, dogleg, 8);
		expect(at).toEqual(anchors.green);
	});
	it("walks from an off-line spot back onto the line", () => {
		const stepped = walkStep(p(0.001, 0.0005), anchors.green, dogleg, 8);
		expect(haversineMeters(stepped, anchors.green)).toBeLessThan(
			haversineMeters(p(0.001, 0.0005), anchors.green),
		);
	});
});
