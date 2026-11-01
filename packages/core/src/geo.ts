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

/**
 * Green front / center / back as distances from `position`, measured along the
 * player→green-center axis (spec §6: polygon extremes along the axis). Front is
 * the nearest edge along that line, back the farthest; center is the centroid.
 */
export function distancesToGreen(
	position: LatLng,
	green: ReadonlyArray<LatLng>,
): { front: number; center: number; back: number } {
	const center = polygonCentroid(green);
	const centerLocal = projectToLocal(position, center);
	const axisLen = Math.hypot(centerLocal.x, centerLocal.y) || 1;
	// Unit vector position→center in local meters.
	const ux = centerLocal.x / axisLen;
	const uy = centerLocal.y / axisLen;
	// Signed distance of each vertex along the axis from `position`.
	const along = green.map((p) => {
		const l = projectToLocal(position, p);
		return l.x * ux + l.y * uy;
	});
	return {
		// On the green the front edge is behind you: 0, not negative.
		front: Math.max(0, Math.min(...along)),
		center: haversineMeters(position, center),
		back: Math.max(...along),
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

/** Initial great-circle bearing from `a` to `b`, degrees clockwise from north
 *  (0–360). Used to rotate the hole view so the tee→green line points up. */
export function bearingDegrees(a: LatLng, b: LatLng): number {
	const φ1 = toRad(a.lat);
	const φ2 = toRad(b.lat);
	const Δλ = toRad(b.lng - a.lng);
	const y = Math.sin(Δλ) * Math.cos(φ2);
	const x =
		Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
	return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point at fraction `t` (0–1) along the straight line a→b. Exact enough at
 *  hole scale; used to place distance labels midway along a line. */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
	return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Where along a→b to put the line's distance label: midway, unless another
 *  label (a hazard callout) sits within `clearance` meters of that spot — then
 *  the nearest fraction that clears it, or failing that the clearest one. */
export function labelSpot(
	a: LatLng,
	b: LatLng,
	avoid: ReadonlyArray<LatLng>,
	clearance = 30,
): LatLng {
	let best = interpolate(a, b, 0.5);
	let bestGap = -1;
	for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) {
		const spot = interpolate(a, b, t);
		const gap = Math.min(
			Number.POSITIVE_INFINITY,
			...avoid.map((p) => haversineMeters(spot, p)),
		);
		if (gap >= clearance) return spot;
		if (gap > bestGap) {
			best = spot;
			bestGap = gap;
		}
	}
	return best;
}

/** Items sorted nearest-first from `position`; items without a location last
 *  (in their original order). Pure: does not mutate the input. */
export function sortByDistance<T extends { location?: LatLng | null }>(
	items: ReadonlyArray<T>,
	position: LatLng,
): Array<T & { distanceMeters: number | null }> {
	return items
		.map((item, index) => ({
			item: {
				...item,
				distanceMeters: item.location
					? haversineMeters(position, item.location)
					: null,
			},
			index,
		}))
		.sort((a, b) => {
			const da = a.item.distanceMeters;
			const db = b.item.distanceMeters;
			if (da === null && db === null) return a.index - b.index;
			if (da === null) return 1;
			if (db === null) return -1;
			return da - db;
		})
		.map(({ item }) => item);
}
