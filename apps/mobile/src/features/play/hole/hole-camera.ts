/**
 * Camera for the satellite hole view: looking straight down, rotated so play
 * runs bottom → top, zoomed so the whole hole (or the green) fits the space
 * between the HUD bars. Pure, so it is unit-tested without a map.
 */
import {
	bearingDegrees,
	haversineMeters,
	interpolate,
	type LatLng,
} from "@fairway/core/geo";

export interface HoleCamera {
	center: LatLng;
	heading: number;
	/** Google Maps zoom level. */
	zoom: number;
	/** Apple Maps camera altitude in metres. */
	altitude: number;
}

/** Metres of map per point at zoom 0 on the equator (256-pt Web Mercator tile). */
const METERS_PER_POINT_Z0 = 156_543.03392;
/** Apple: a top-down camera this high sees ≈ this many metres of height. */
const APPLE_ALTITUDE_PER_METER = 1.75;

export function holeCamera({
	from,
	green,
	viewportHeight,
	greenView,
}: {
	from: LatLng;
	green: LatLng;
	/** Points of map height left between the HUD bars. */
	viewportHeight: number;
	greenView: boolean;
}): HoleCamera {
	const heading = bearingDegrees(from, green);
	const length = haversineMeters(from, green);
	// Whole hole: tee to just past the green. Green view: ~45 m around it.
	const span = greenView ? 45 : Math.max(length * 1.18, 80);
	const center = greenView ? green : interpolate(from, green, 0.53);
	const metersPerPoint = span / Math.max(viewportHeight, 1);
	const zoom = Math.log2(
		(METERS_PER_POINT_Z0 * Math.cos((center.lat * Math.PI) / 180)) /
			metersPerPoint,
	);
	return {
		center,
		heading,
		zoom: Math.min(Math.max(zoom, 14), 21),
		altitude: span * APPLE_ALTITUDE_PER_METER,
	};
}
