import { describe, expect, it } from "vitest";
import type { LatLng } from "../../domain/geo";
import { buildProjector } from "./projection";

const tee: LatLng = { lat: 52.0, lng: 5.8 };
// ~300 m roughly north-east of the tee
const green: LatLng = { lat: 52.0023, lng: 5.8015 };
const opts = {
	tee,
	green,
	features: [[tee, green]],
	width: 300,
	height: 500,
	padding: 24,
};

describe("buildProjector", () => {
	it("places the green above the tee (axis vertical, green up)", () => {
		const proj = buildProjector(opts);
		const t = proj.project(tee);
		const g = proj.project(green);
		expect(g.y).toBeLessThan(t.y); // smaller screen-y = higher up
		expect(Math.abs(g.x - t.x)).toBeLessThan(1); // axis vertical → same x
	});

	it("fits all points inside the padded viewport", () => {
		const proj = buildProjector(opts);
		for (const p of [tee, green]) {
			const s = proj.project(p);
			expect(s.x).toBeGreaterThanOrEqual(opts.padding - 0.5);
			expect(s.x).toBeLessThanOrEqual(opts.width - opts.padding + 0.5);
			expect(s.y).toBeGreaterThanOrEqual(opts.padding - 0.5);
			expect(s.y).toBeLessThanOrEqual(opts.height - opts.padding + 0.5);
		}
	});

	it("project ∘ unproject is ~identity", () => {
		const proj = buildProjector(opts);
		const round = proj.unproject(proj.project(green));
		expect(round.lat).toBeCloseTo(green.lat, 5);
		expect(round.lng).toBeCloseTo(green.lng, 5);
	});

	it("scale is positive pixels-per-meter", () => {
		expect(buildProjector(opts).scale).toBeGreaterThan(0);
	});
});
