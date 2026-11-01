import { describe, expect, it } from "vitest";
import { CATALOG, geometryFor } from "./index";

describe("course catalog", () => {
	it("has unique, stable keys", () => {
		const keys = CATALOG.map((c) => c.key);
		expect(new Set(keys).size).toBe(keys.length);
		for (const key of keys) expect(key).toMatch(/^[a-z0-9-]+$/);
	});

	for (const course of CATALOG) {
		describe(course.key, () => {
			it("numbers holes 1..n with unique refs", () => {
				expect(course.holes.map((h) => h.number)).toEqual(
					course.holes.map((_, i) => i + 1),
				);
				const refs = course.holes.map((h) => h.ref);
				expect(new Set(refs).size).toBe(refs.length);
			});

			it("has plausible par and a unique stroke index per hole", () => {
				for (const h of course.holes) {
					expect([3, 4, 5, 6]).toContain(h.par);
					expect(h.strokeIndex).toBeGreaterThanOrEqual(1);
					expect(h.strokeIndex).toBeLessThanOrEqual(18);
					expect(h.lengthMeters).toBeGreaterThan(40);
				}
				const si = course.holes.map((h) => h.strokeIndex);
				expect(new Set(si).size).toBe(si.length);
			});

			it("rates every tee and cites a source", () => {
				expect(course.tees.length).toBeGreaterThan(0);
				const names = course.tees.map((t) => t.name);
				expect(new Set(names).size).toBe(names.length);
				const ninehole = course.holes.length === 9;
				for (const t of course.tees) {
					expect(t.slopeRating).toBeGreaterThanOrEqual(55);
					expect(t.slopeRating).toBeLessThanOrEqual(155);
					const [lo, hi] = ninehole ? [20, 40] : [50, 80];
					expect(t.courseRating).toBeGreaterThan(lo);
					expect(t.courseRating).toBeLessThan(hi);
				}
				expect(course.sources.length).toBeGreaterThan(0);
			});

			it("has map geometry for every hole, at most one green each", () => {
				const geometry = geometryFor(course);
				expect(geometry.map((g) => g.ref)).toEqual(
					course.holes.map((h) => h.ref),
				);
				for (const g of geometry) {
					expect(g.holeLine?.length ?? 0).toBeGreaterThan(1);
					expect(g.greens.length).toBeLessThanOrEqual(1);
				}
				// Holes without a mapped green fall back to the hole line's end.
				const withGreen = geometry.filter((g) => g.greens.length > 0);
				expect(withGreen.length / geometry.length).toBeGreaterThan(0.8);
			});
		});
	}
});
