/**
 * Google Maps honours `mapPadding` when it frames a camera; Apple Maps (via
 * react-native-maps) does not, so for Apple the centre is moved by hand to
 * where the padded area's centre would be.
 */
import {
	bearingDegrees,
	haversineMeters,
	interpolate,
	type LatLng,
} from "@fairway/core/geo";
import type { Camera } from "react-native-maps";

export const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

interface HoleCamera {
	center: LatLng;
	heading: number;
	/** Google Maps zoom level. */
	zoom: number;
	/** Apple Maps camera altitude in metres. */
	altitude: number;
}

/** Metres of map per point at zoom 0 on the equator (256-pt Web Mercator tile). */
const METERS_PER_POINT_Z0 = 156_543.03392;
/** Apple: camera altitude per metre of full map height (measured, iOS 27). */
const APPLE_ALTITUDE_PER_METER = 1.84;

export function holeCamera({
	from,
	green,
	height,
	insets,
	greenView,
	paddingFramesCamera,
}: {
	from: LatLng;
	green: LatLng;
	/** Full map height in points. */
	height: number;
	/** Points covered by the HUD above and below the hole. */
	insets: { top: number; bottom: number };
	greenView: boolean;
	/** True where the map frames the camera inside its padding (Google). */
	paddingFramesCamera: boolean;
}): HoleCamera {
	const heading = bearingDegrees(from, green);
	const length = haversineMeters(from, green);
	// Whole hole: tee to just past the green. Green view: ~45 m around it.
	const span = greenView ? 45 : Math.max(length * 1.18, 80);
	const middle = greenView ? green : interpolate(from, green, 0.53);
	const viewport = Math.max(height - insets.top - insets.bottom, 1);
	const metersPerPoint = span / viewport;
	const zoom = Math.log2(
		(METERS_PER_POINT_Z0 * Math.cos((middle.lat * Math.PI) / 180)) /
			metersPerPoint,
	);

	// The padded area's centre sits (bottom − top) / 2 points above the view
	// centre; aim the camera that far down the hole so `middle` lands there.
	const shift = paddingFramesCamera
		? 0
		: ((insets.bottom - insets.top) / 2) * metersPerPoint;
	const toFrom = haversineMeters(middle, from);
	const center =
		shift === 0 || toFrom === 0
			? middle
			: interpolate(middle, from, shift / toFrom);

	return {
		center,
		heading,
		zoom: Math.min(Math.max(zoom, 14), 21),
		altitude: metersPerPoint * Math.max(height, 1) * APPLE_ALTITUDE_PER_METER,
	};
}

/** The loupe: same heading as the hole view, about 4× closer. */
export function loupeCamera(camera: Camera, at: LatLng): Partial<Camera> {
	return {
		center: toCoord(at),
		heading: camera.heading,
		pitch: 0,
		zoom: camera.zoom === undefined ? undefined : camera.zoom + 2,
		altitude: camera.altitude === undefined ? undefined : camera.altitude / 4,
	};
}
