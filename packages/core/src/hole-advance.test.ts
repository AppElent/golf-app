import { describe, expect, it } from "vitest";
import { shouldAdvance } from "./hole-advance";

const p = (dLat: number, dLng = 0) => ({ lat: 52 + dLat, lng: 5.9 + dLng });
const current = { tee: p(0), green: p(0.003) };
const next = { tee: p(0.0034), green: p(0.0064) };

describe("shouldAdvance", () => {
	it("advances on the next tee once the green is behind", () => {
		expect(shouldAdvance(p(0.0034), current, next)).toBe(true);
	});
	it("does not advance mid-hole", () => {
		expect(shouldAdvance(p(0.0015), current, next)).toBe(false);
	});
	it("does not advance on a next tee beside the green until it is behind", () => {
		const besideGreen = { tee: p(0.0031), green: p(0.0064) }; // ~11 m past it
		expect(shouldAdvance(p(0.003), current, besideGreen)).toBe(false);
		expect(shouldAdvance(p(0.0031), current, besideGreen)).toBe(false);
		// Still within the tee radius, now past the green by more than the margin.
		expect(shouldAdvance(p(0.0033), current, besideGreen)).toBe(true);
	});
	it("does not advance on the walk off the green, nearer it than the tee", () => {
		expect(shouldAdvance(p(0.00315), current, next)).toBe(false);
	});
	it("does not advance on the last hole", () => {
		expect(shouldAdvance(p(0.0034), current, undefined)).toBe(false);
	});
	it("widens the tee radius by GPS accuracy, capped", () => {
		const nearTee = p(0.0034 + 0.0004); // ~44 m past the tee
		expect(shouldAdvance(nearTee, current, next, 0)).toBe(false);
		expect(shouldAdvance(nearTee, current, next, 20)).toBe(true);
		const farFromTee = p(0.0034 + 0.0006); // ~67 m past the tee
		expect(shouldAdvance(farFromTee, current, next, 100)).toBe(false);
	});
});
