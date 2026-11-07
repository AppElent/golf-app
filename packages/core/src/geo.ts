export interface LatLng {
	lat: number;
	lng: number;
}

export const EARTH_RADIUS_M = 6371000;

/** A GPS fix less accurate than this is shown as uncertain. */
export const GPS_WEAK_ACCURACY_M = 15;

export const toRad = (deg: number): number => (deg * Math.PI) / 180;

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

/** Length of a polyline in meters. */
export function polylineLength(line: ReadonlyArray<LatLng>): number {
	let total = 0;
	for (let i = 1; i < line.length; i++) {
		total += haversineMeters(line[i - 1], line[i]);
	}
	return total;
}

/** Where a point falls on a polyline. */
export interface PolylineFix {
	/** Meters from the line's start to the closest point, following the line. */
	along: number;
	/** Meters from the point to the line. */
	offset: number;
	/** Which side of the line's direction the point lies on. */
	side: "left" | "right";
}

/** Project a point onto a polyline of at least one point. */
export function locateOnPolyline(
	point: LatLng,
	line: ReadonlyArray<LatLng>,
): PolylineFix {
	const origin = line[0];
	const p = projectToLocal(origin, point);
	let best: PolylineFix = {
		along: 0,
		offset: haversineMeters(point, origin),
		side: "left",
	};
	let walked = 0;
	for (let i = 1; i < line.length; i++) {
		const a = projectToLocal(origin, line[i - 1]);
		const b = projectToLocal(origin, line[i]);
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const segment = Math.hypot(dx, dy);
		const t =
			segment === 0
				? 0
				: Math.max(
						0,
						Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / segment ** 2),
					);
		const offset = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
		if (i === 1 || offset < best.offset) {
			best = {
				along: walked + t * segment,
				offset,
				side: dx * (p.y - a.y) - dy * (p.x - a.x) >= 0 ? "left" : "right",
			};
		}
		walked += segment;
	}
	return best;
}

/** The point `meters` along a polyline, clamped to its ends. */
export function pointAlongPolyline(
	line: ReadonlyArray<LatLng>,
	meters: number,
): LatLng {
	let left = meters;
	for (let i = 1; i < line.length; i++) {
		const segment = haversineMeters(line[i - 1], line[i]);
		if (left <= segment) {
			return interpolate(
				line[i - 1],
				line[i],
				segment === 0 ? 0 : left / segment,
			);
		}
		left -= segment;
	}
	return line[line.length - 1];
}

type Point2 = { x: number; y: number };

/** Where a line passes through a closed ring's edge, in order along the line. */
export function polylineCrossings(
	line: ReadonlyArray<LatLng>,
	ring: ReadonlyArray<LatLng>,
): LatLng[] {
	if (line.length < 2 || ring.length < 2) return [];
	const origin = line[0];
	const local = (p: LatLng) => projectToLocal(origin, p);
	const turn = (a: Point2, b: Point2, c: Point2) =>
		(b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
	const path = line.map(local);
	const edge = ring.map(local);
	const found: Array<{ along: number; point: LatLng }> = [];
	let walked = 0;
	for (let i = 1; i < path.length; i++) {
		const a = path[i - 1];
		const b = path[i];
		for (let j = 0; j < edge.length; j++) {
			const c = edge[j];
			const d = edge[(j + 1) % edge.length];
			const fromC = turn(a, b, c);
			const fromD = turn(a, b, d);
			const fromA = turn(c, d, a);
			const fromB = turn(c, d, b);
			if (fromC * fromD < 0 && fromA * fromB < 0) {
				const t = fromA / (fromA - fromB);
				found.push({
					along: walked + t * Math.hypot(b.x - a.x, b.y - a.y),
					point: interpolate(line[i - 1], line[i], t),
				});
			}
		}
		walked += Math.hypot(b.x - a.x, b.y - a.y);
	}
	return found.sort((x, y) => x.along - y.along).map((x) => x.point);
}

/** A bend smaller than this is a mapper's wobble, not a dogleg. */
const CORNER_TOLERANCE_M = 10;

/** Where a line really changes direction (Douglas-Peucker), ends excluded. */
function corners(line: ReadonlyArray<LatLng>): LatLng[] {
	if (line.length < 3) return [];
	const chord = [line[0], line[line.length - 1]];
	let farthest = 0;
	let farthestOffset = CORNER_TOLERANCE_M;
	for (let i = 1; i < line.length - 1; i++) {
		const { offset } = locateOnPolyline(line[i], chord);
		if (offset > farthestOffset) {
			farthest = i;
			farthestOffset = offset;
		}
	}
	if (farthest === 0) return [];
	return [
		...corners(line.slice(0, farthest + 1)),
		line[farthest],
		...corners(line.slice(farthest)),
	];
}

/** Meters from a tee to a green the way a card measures: straight from the tee
 *  to each dogleg still ahead of it, then to the green. */
export function routeMeters(
	from: LatLng,
	line: ReadonlyArray<LatLng>,
	to: LatLng,
): number {
	const start = locateOnPolyline(from, line).along;
	const end = locateOnPolyline(to, line).along;
	const ahead = corners(line).filter((corner) => {
		const { along } = locateOnPolyline(corner, line);
		return along > start && along < end;
	});
	return polylineLength([from, ...ahead, to]);
}
