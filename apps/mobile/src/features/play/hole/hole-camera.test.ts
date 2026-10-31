import { haversineMeters } from "@fairway/core/geo";
import { holeCamera } from "./hole-camera";

const tee = { lat: 52, lng: 5.9 };
const green = { lat: 52.003, lng: 5.9 }; // ~334 m due north
const base = {
	from: tee,
	green,
	height: 800,
	insets: { top: 100, bottom: 100 },
	greenView: false,
	paddingFramesCamera: true,
};

describe("holeCamera", () => {
	it("points up the hole and centres just past half way", () => {
		const cam = holeCamera(base);
		expect(cam.heading).toBeCloseTo(0, 3);
		expect(cam.center.lat).toBeGreaterThan(52.0015);
		expect(cam.zoom).toBeGreaterThan(16);
		expect(cam.zoom).toBeLessThan(18);
	});

	it("zooms in further for the green view, centred on the green", () => {
		const hole = holeCamera(base);
		const view = holeCamera({ ...base, greenView: true });
		expect(view.center).toEqual(green);
		expect(view.zoom).toBeGreaterThan(hole.zoom);
		expect(view.altitude).toBeLessThan(hole.altitude);
	});

	it("aims down the hole by hand where padding does not frame the camera", () => {
		const insets = { top: 100, bottom: 200 };
		const google = holeCamera({ ...base, insets });
		const apple = holeCamera({ ...base, insets, paddingFramesCamera: false });
		// Half the inset difference (50 pt) at 334 m × 1.18 over 500 pt ≈ 39 m.
		expect(haversineMeters(google.center, apple.center)).toBeCloseTo(39.4, 0);
		expect(apple.center.lat).toBeLessThan(google.center.lat);
	});

	it("does not move the camera when the insets are even", () => {
		const apple = holeCamera({ ...base, paddingFramesCamera: false });
		expect(apple.center).toEqual(holeCamera(base).center);
	});
});
