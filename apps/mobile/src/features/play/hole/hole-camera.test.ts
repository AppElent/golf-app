import { holeCamera } from "./hole-camera";

const tee = { lat: 52, lng: 5.9 };
const green = { lat: 52.003, lng: 5.9 }; // ~334 m due north

describe("holeCamera", () => {
	it("points up the hole and centres just past half way", () => {
		const cam = holeCamera({
			from: tee,
			green,
			viewportHeight: 600,
			greenView: false,
		});
		expect(cam.heading).toBeCloseTo(0, 3);
		expect(cam.center.lat).toBeGreaterThan(52.0015);
		expect(cam.zoom).toBeGreaterThan(16);
		expect(cam.zoom).toBeLessThan(18);
	});

	it("zooms in further for the green view, centred on the green", () => {
		const hole = holeCamera({
			from: tee,
			green,
			viewportHeight: 600,
			greenView: false,
		});
		const view = holeCamera({
			from: tee,
			green,
			viewportHeight: 600,
			greenView: true,
		});
		expect(view.center).toEqual(green);
		expect(view.zoom).toBeGreaterThan(hole.zoom);
		expect(view.altitude).toBeLessThan(hole.altitude);
	});
});
