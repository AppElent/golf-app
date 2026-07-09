export interface LatLng {
	lat: number;
	lng: number;
}

const EARTH_RADIUS_M = 6371000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const sinLat = Math.sin(dLat / 2);
	const sinLng = Math.sin(dLng / 2);
	const h =
		sinLat * sinLat +
		Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Equirectangular projection to a local meter grid around `origin`
 * (x = meters east, y = meters north). Accurate to well under a meter at
 * golf-hole scale; this is the layer a satellite underlay would share.
 */
export function projectToLocal(
	origin: LatLng,
	point: LatLng,
): { x: number; y: number } {
	const x =
		toRad(point.lng - origin.lng) *
		Math.cos(toRad(origin.lat)) *
		EARTH_RADIUS_M;
	const y = toRad(point.lat - origin.lat) * EARTH_RADIUS_M;
	return { x, y };
}

/** Vertex average — adequate for compact convex-ish golf features. */
export function polygonCentroid(points: ReadonlyArray<LatLng>): LatLng {
	const lat = points.reduce((total, p) => total + p.lat, 0) / points.length;
	const lng = points.reduce((total, p) => total + p.lng, 0) / points.length;
	return { lat, lng };
}

export function distancesToGreen(
	position: LatLng,
	green: ReadonlyArray<LatLng>,
): { front: number; center: number; back: number } {
	const vertexDistances = green.map((p) => haversineMeters(position, p));
	return {
		front: Math.min(...vertexDistances),
		center: haversineMeters(position, polygonCentroid(green)),
		back: Math.max(...vertexDistances),
	};
}

export function carryDistances(
	position: LatLng,
	hazard: ReadonlyArray<LatLng>,
): { reach: number; carry: number } {
	const vertexDistances = hazard.map((p) => haversineMeters(position, p));
	return {
		reach: Math.min(...vertexDistances),
		carry: Math.max(...vertexDistances),
	};
}
