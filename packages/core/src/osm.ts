export interface LatLng {
	lat: number;
	lng: number;
}

export interface NormalizedHole {
	number: number;
	ref: string;
	par: number | null;
	strokeIndex: number | null;
	line: LatLng[];
	lengthMeters: number;
}

export interface HoleGeometry {
	ref: string;
	holeNumber: number;
	holeLine: LatLng[];
	fairways: LatLng[][];
	greens: LatLng[][];
	bunkers: LatLng[][];
	tees: LatLng[][];
	water: LatLng[][];
}

export interface NormalizedCourse {
	holes: NormalizedHole[];
	geometry: HoleGeometry[];
}

// OSM tag lookups are effectively optional; JSON imports also infer `undefined`
// for keys absent from some elements, so the value type must allow it.
type Tags = Record<string, string | undefined>;

const firstInt = (value: string | undefined): number | null => {
	if (!value) return null;
	const match = value.match(/-?\d+/);
	return match ? Number.parseInt(match[0], 10) : null;
};

/** Parse an OSM hole `ref` ("10", "(3)", "1;10") into a number + raw ref. */
export function parseHoleRef(ref: string | undefined): {
	number: number;
	ref: string;
} {
	return { number: firstInt(ref) ?? 0, ref: ref ?? "" };
}

/** OSM `par` tag → integer, or null when the course isn't par-tagged. */
export function parsePar(tags: Tags): number | null {
	return firstInt(tags.par);
}

/** Stroke index from `golf:stroke_index` (preferred) or `handicap`. */
export function parseStrokeIndex(tags: Tags): number | null {
	const si = firstInt(tags["golf:stroke_index"]);
	if (si !== null) return si;
	return firstInt(tags.handicap);
}

interface OverpassGeom {
	lat: number;
	lon: number;
}
interface OverpassElement {
	type: string;
	id: number;
	tags?: Tags;
	geometry?: OverpassGeom[];
	/** Nodes (`golf=pin`) carry a position instead of a geometry. */
	lat?: number;
	lon?: number;
}

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

function haversine(a: LatLng, b: LatLng): number {
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const s =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

export function lineLengthMeters(points: ReadonlyArray<LatLng>): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		total += haversine(points[i - 1], points[i]);
	}
	return total;
}

export function centroid(points: ReadonlyArray<LatLng>): LatLng {
	const n = points.length || 1;
	return {
		lat: points.reduce((t, p) => t + p.lat, 0) / n,
		lng: points.reduce((t, p) => t + p.lng, 0) / n,
	};
}

const toLatLng = (g: OverpassGeom): LatLng => ({ lat: g.lat, lng: g.lon });
const geomOf = (el: OverpassElement): LatLng[] =>
	(el.geometry ?? []).map(toLatLng);

/** Nearest hole ref to a feature centroid, by distance to hole-line vertices. */
function nearestHoleRef(
	point: LatLng,
	holeLines: ReadonlyArray<{ ref: string; line: LatLng[] }>,
): string {
	let bestRef = holeLines[0]?.ref ?? "";
	let bestDist = Number.POSITIVE_INFINITY;
	for (const hole of holeLines) {
		for (const vertex of hole.line) {
			const d = haversine(point, vertex);
			if (d < bestDist) {
				bestDist = d;
				bestRef = hole.ref;
			}
		}
	}
	return bestRef;
}

/** A green further than this from every hole's end is a practice green. */
const GREEN_MATCH_METERS = 60;

function pointInPolygon(point: LatLng, ring: ReadonlyArray<LatLng>): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const a = ring[i];
		const b = ring[j];
		if (
			a.lat > point.lat !== b.lat > point.lat &&
			point.lng <
				((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng
		) {
			inside = !inside;
		}
	}
	return inside;
}

/** 0 when the point is on the green, else the distance to its nearest vertex. */
function distanceToRing(point: LatLng, ring: ReadonlyArray<LatLng>): number {
	if (pointInPolygon(point, ring)) return 0;
	return Math.min(...ring.map((v) => haversine(point, v)));
}

/**
 * Pair holes with greens, closest pairs first, each hole and green used once,
 * ignoring pairs further apart than GREEN_MATCH_METERS. Either end of a hole
 * line may be its green end — mappers sometimes draw a hole green-to-tee —
 * so `reversed` says the green is at the line's start.
 */
function matchGreens(
	holeLines: ReadonlyArray<{ ref: string; line: LatLng[] }>,
	greens: ReadonlyArray<LatLng[]>,
): { ref: string; green: LatLng[]; reversed: boolean }[] {
	const pairs: { ref: string; green: number; d: number; reversed: boolean }[] =
		[];
	for (const hole of holeLines) {
		if (hole.line.length < 2) continue;
		const ends = [
			{ point: hole.line[hole.line.length - 1], reversed: false },
			{ point: hole.line[0], reversed: true },
		];
		for (const { point, reversed } of ends) {
			greens.forEach((ring, green) => {
				const d = distanceToRing(point, ring);
				if (d <= GREEN_MATCH_METERS) {
					pairs.push({ ref: hole.ref, green, d, reversed });
				}
			});
		}
	}
	// Prefer the drawn direction on a tie (both ends on a green is rare).
	pairs.sort((a, b) => a.d - b.d || Number(a.reversed) - Number(b.reversed));
	const usedRefs = new Set<string>();
	const usedGreens = new Set<number>();
	const matched: { ref: string; green: LatLng[]; reversed: boolean }[] = [];
	for (const pair of pairs) {
		if (usedRefs.has(pair.ref) || usedGreens.has(pair.green)) continue;
		usedRefs.add(pair.ref);
		usedGreens.add(pair.green);
		matched.push({
			ref: pair.ref,
			green: greens[pair.green],
			reversed: pair.reversed,
		});
	}
	return matched;
}

/** A pin this close to a hole end, on no mapped green, marks that hole's green. */
const PIN_MATCH_METERS = 15;
/** Radius of the stand-in green drawn around a lone pin (~450 m²). */
const PIN_GREEN_RADIUS_M = 12;

/** A 16-gon around a point: an approximate green where only the pin is mapped. */
export function circleAround(center: LatLng, radiusM: number): LatLng[] {
	const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
	const dLng = dLat / Math.cos(toRad(center.lat));
	return Array.from({ length: 16 }, (_, i) => {
		const a = (i / 16) * 2 * Math.PI;
		return {
			lat: center.lat + dLat * Math.sin(a),
			lng: center.lng + dLng * Math.cos(a),
		};
	});
}

/**
 * Holes left without a green whose line ends on a `golf=pin` node that sits on
 * no mapped green: the green polygon was never drawn, but the pin says where
 * it is. Same closest-first, one-to-one pairing as `matchGreens`.
 */
function matchPins(
	holeLines: ReadonlyArray<{ ref: string; line: LatLng[] }>,
	pins: ReadonlyArray<LatLng>,
): { ref: string; pin: LatLng; reversed: boolean }[] {
	const pairs: { ref: string; pin: number; d: number; reversed: boolean }[] =
		[];
	for (const hole of holeLines) {
		if (hole.line.length < 2) continue;
		const ends = [
			{ point: hole.line[hole.line.length - 1], reversed: false },
			{ point: hole.line[0], reversed: true },
		];
		for (const { point, reversed } of ends) {
			pins.forEach((pin, i) => {
				const d = haversine(point, pin);
				if (d <= PIN_MATCH_METERS)
					pairs.push({ ref: hole.ref, pin: i, d, reversed });
			});
		}
	}
	pairs.sort((a, b) => a.d - b.d || Number(a.reversed) - Number(b.reversed));
	const usedRefs = new Set<string>();
	const usedPins = new Set<number>();
	const matched: { ref: string; pin: LatLng; reversed: boolean }[] = [];
	for (const pair of pairs) {
		if (usedRefs.has(pair.ref) || usedPins.has(pair.pin)) continue;
		usedRefs.add(pair.ref);
		usedPins.add(pair.pin);
		matched.push({
			ref: pair.ref,
			pin: pins[pair.pin],
			reversed: pair.reversed,
		});
	}
	return matched;
}

const isWater = (tags: Tags | undefined): boolean =>
	tags !== undefined &&
	(tags.golf === "water_hazard" ||
		tags.golf === "lateral_water_hazard" ||
		tags.natural === "water");

/**
 * Turn raw Overpass elements (from `out geom tags` over a course area) into
 * normalized holes + per-hole geometry. Area features (green/fairway/bunker/
 * tee/water) are bucketed onto the nearest `golf=hole` line, keyed by hole
 * number (holes that repeat across loops share one geometry bucket). `rough`,
 * paths, and driving ranges are intentionally dropped.
 */
export function normalizeCourse(
	elements: ReadonlyArray<OverpassElement>,
): NormalizedCourse {
	const holeElements = elements.filter((e) => e.tags?.golf === "hole");

	// Unnumbered `golf=hole` ways (ref absent/non-numeric) are stray geometry,
	// not scorecard holes — drop them so they neither appear nor attract features.
	const holes: NormalizedHole[] = holeElements
		.map((el) => {
			const tags = el.tags ?? {};
			const { number, ref } = parseHoleRef(tags.ref);
			const line = geomOf(el);
			return {
				number,
				ref,
				par: parsePar(tags),
				strokeIndex: parseStrokeIndex(tags),
				line,
				lengthMeters: lineLengthMeters(line),
			};
		})
		.filter((h) => h.number >= 1);

	// Bucket geometry by ref (unique per physical hole across loops).
	const geometry = new Map<string, HoleGeometry>();
	for (const hole of holes) {
		if (!geometry.has(hole.ref)) {
			geometry.set(hole.ref, {
				ref: hole.ref,
				holeNumber: hole.number,
				holeLine: hole.line,
				fairways: [],
				greens: [],
				bunkers: [],
				tees: [],
				water: [],
			});
		}
	}

	const holeLines = holes.map((h) => ({ ref: h.ref, line: h.line }));

	// Greens are matched to the hole line that ends on them, one green per
	// hole: the nearest-vertex rule below hands practice greens and the green
	// of a hole running past to the wrong hole.
	const greens = elements.filter(
		(el) =>
			el.tags?.golf === "green" && !isWater(el.tags) && geomOf(el).length > 2,
	);
	const greenRings = greens.map(geomOf);
	const matchedGreens = matchGreens(holeLines, greenRings);
	const greenless = holeLines.filter(
		(h) => !matchedGreens.some((m) => m.ref === h.ref),
	);
	const lonePins = elements
		.filter(
			(el) =>
				el.type === "node" &&
				el.tags?.golf === "pin" &&
				el.lat !== undefined &&
				el.lon !== undefined,
		)
		.map((el) => ({ lat: el.lat as number, lng: el.lon as number }))
		.filter((pin) => !greenRings.some((ring) => pointInPolygon(pin, ring)));
	const pinGreens = matchPins(greenless, lonePins).map(
		({ ref, pin, reversed }) => ({
			ref,
			green: circleAround(pin, PIN_GREEN_RADIUS_M),
			reversed,
		}),
	);
	for (const { ref, green, reversed } of [...matchedGreens, ...pinGreens]) {
		const target = geometry.get(ref);
		if (!target) continue;
		target.greens.push(green);
		// Tee → green, which is what the hole view and distances assume.
		if (reversed) target.holeLine = [...target.holeLine].reverse();
	}

	for (const el of elements) {
		const golf = el.tags?.golf;
		if (!golf || golf === "hole" || golf === "green") continue;
		const poly = geomOf(el);
		if (poly.length < 2) continue;
		const target = geometry.get(nearestHoleRef(centroid(poly), holeLines));
		if (!target) continue;
		if (isWater(el.tags ?? {})) target.water.push(poly);
		else if (golf === "fairway") target.fairways.push(poly);
		else if (golf === "bunker") target.bunkers.push(poly);
		else if (golf === "tee") target.tees.push(poly);
		// rough / path / cartpath / driving_range: dropped by design.
	}

	return { holes, geometry: [...geometry.values()] };
}
