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

const isWater = (tags: Tags): boolean =>
	tags.golf === "water_hazard" ||
	tags.golf === "lateral_water_hazard" ||
	tags.natural === "water";

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

	for (const el of elements) {
		const golf = el.tags?.golf;
		if (!golf || golf === "hole") continue;
		const poly = geomOf(el);
		if (poly.length < 2) continue;
		const target = geometry.get(nearestHoleRef(centroid(poly), holeLines));
		if (!target) continue;
		if (isWater(el.tags ?? {})) target.water.push(poly);
		else if (golf === "green") target.greens.push(poly);
		else if (golf === "fairway") target.fairways.push(poly);
		else if (golf === "bunker") target.bunkers.push(poly);
		else if (golf === "tee") target.tees.push(poly);
		// rough / path / cartpath / driving_range: dropped by design.
	}

	return { holes, geometry: [...geometry.values()] };
}
