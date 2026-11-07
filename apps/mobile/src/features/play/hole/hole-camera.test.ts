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

/** Metres of map per point at a Google zoom level (256-pt Web Mercator tiles). */
const metersPerPoint = (zoom: number, lat: number) =>
	(156_543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;

describe("holeCamera", () => {
	it("points up the hole, centred just past half way", () => {
		const cam = holeCamera(base);
		expect(cam.heading).toBeCloseTo(0, 3);
		expect(cam.center.lat).toBeGreaterThan(52.0015);
		expect(cam.center.lat).toBeLessThan(52.0018);
	});

	it("fits the whole hole between the HUDs without leaving it small", () => {
		const cam = holeCamera(base);
		const visible = metersPerPoint(cam.zoom, cam.center.lat) * 600;
		const length = haversineMeters(tee, green);
		expect(visible).toBeGreaterThanOrEqual(length);
		expect(visible).toBeLessThan(length * 1.5);
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
		// Half the inset difference, at the map's own scale.
		const expected = 50 * metersPerPoint(google.zoom, google.center.lat);
		expect(haversineMeters(google.center, apple.center)).toBeCloseTo(
			expected,
			0,
		);
		expect(apple.center.lat).toBeLessThan(google.center.lat);
	});

	it("does not move the camera when the insets are even", () => {
		const apple = holeCamera({ ...base, paddingFramesCamera: false });
		expect(apple.center).toEqual(holeCamera(base).center);
	});
});
