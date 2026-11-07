import {
	EARTH_RADIUS_M,
	haversineMeters,
	type LatLng,
	polygonCentroid,
	toRad,
} from "./geo.ts";
import type { HoleGeometry } from "./hole-view.ts";

export interface NormalizedHole {
	number: number;
	ref: string;
	line: LatLng[];
}

export interface OsmHoleGeometry extends HoleGeometry {
	ref: string;
	holeNumber: number;
	holeLine: LatLng[];
}

export interface NormalizedCourse {
	holes: NormalizedHole[];
	geometry: OsmHoleGeometry[];
}

// OSM tag lookups are effectively optional; JSON imports also infer `undefined`
// for keys absent from some elements, so the value type must allow it.
type Tags = Record<string, string | undefined>;

/** Parse an OSM hole `ref` ("10", "(3)", "1;10") into a number + raw ref. */
export function parseHoleRef(ref: string | undefined): {
	number: number;
	ref: string;
} {
	const firstInt = ref?.match(/-?\d+/);
	return {
		number: firstInt ? Number.parseInt(firstInt[0], 10) : 0,
		ref: ref ?? "",
	};
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
			const d = haversineMeters(point, vertex);
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
	return Math.min(...ring.map((v) => haversineMeters(point, v)));
}

/**
 * Pair holes with candidates (greens, pins) by the distance from a hole's end:
 * closest pairs first, each hole and candidate used once, ignoring pairs further
 * apart than `maxMeters`. Either end of a hole line may be its green end —
 * mappers sometimes draw a hole green-to-tee — so `reversed` says the candidate
 * is at the line's start.
 */
function pairClosest<T>(
	holeLines: ReadonlyArray<{ ref: string; line: LatLng[] }>,
	candidates: ReadonlyArray<T>,
	distance: (end: LatLng, candidate: T) => number,
	maxMeters: number,
): { ref: string; match: T; reversed: boolean }[] {
	const pairs: {
		ref: string;
		candidate: number;
		d: number;
		reversed: boolean;
	}[] = [];
	for (const hole of holeLines) {
		if (hole.line.length < 2) continue;
		const ends = [
			{ point: hole.line[hole.line.length - 1], reversed: false },
			{ point: hole.line[0], reversed: true },
		];
		for (const { point, reversed } of ends) {
			candidates.forEach((item, candidate) => {
				const d = distance(point, item);
				if (d <= maxMeters) {
					pairs.push({ ref: hole.ref, candidate, d, reversed });
				}
			});
		}
	}
	// Prefer the drawn direction on a tie (both ends on a green is rare).
	pairs.sort((a, b) => a.d - b.d || Number(a.reversed) - Number(b.reversed));
	const usedRefs = new Set<string>();
	const usedCandidates = new Set<number>();
	const matched: { ref: string; match: T; reversed: boolean }[] = [];
	for (const pair of pairs) {
		if (usedRefs.has(pair.ref) || usedCandidates.has(pair.candidate)) continue;
		usedRefs.add(pair.ref);
		usedCandidates.add(pair.candidate);
		matched.push({
			ref: pair.ref,
			match: candidates[pair.candidate],
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
function circleAround(center: LatLng, radiusM: number): LatLng[] {
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

const isWater = (tags: Tags | undefined): boolean =>
	tags !== undefined &&
	(tags.golf === "water_hazard" ||
		tags.golf === "lateral_water_hazard" ||
		tags.natural === "water");

/**
 * Turn raw Overpass elements (from `out geom tags` over a course area) into
 * normalized holes + per-hole geometry. Area features (green/fairway/bunker/
 * tee/water) are bucketed onto the nearest `golf=hole` line, keyed by ref.
 * `rough`, paths, and driving ranges are intentionally dropped. Only geometry
 * comes from OSM: par, stroke index and lengths are curated in convex/catalog.
 */
export function normalizeCourse(
	elements: ReadonlyArray<OverpassElement>,
): NormalizedCourse {
	const holeElements = elements.filter((e) => e.tags?.golf === "hole");

	// Unnumbered `golf=hole` ways (ref absent/non-numeric) are stray geometry,
	// not scorecard holes — drop them so they neither appear nor attract features.
	const holes: NormalizedHole[] = holeElements
		.map((el) => ({ ...parseHoleRef(el.tags?.ref), line: geomOf(el) }))
		.filter((h) => h.number >= 1);

	// Bucket geometry by ref (unique per physical hole across loops).
	const geometry = new Map<string, OsmHoleGeometry>();
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
	const matchedGreens = pairClosest(
		holeLines,
		greenRings,
		distanceToRing,
		GREEN_MATCH_METERS,
	);
	// A hole left without a green whose line ends on a `golf=pin` node sitting on
	// no mapped green: the polygon was never drawn, but the pin says where it is.
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
	const pinGreens = pairClosest(
		greenless,
		lonePins,
		haversineMeters,
		PIN_MATCH_METERS,
	).map(({ ref, match: pin, reversed }) => ({
		ref,
		match: circleAround(pin, PIN_GREEN_RADIUS_M),
		reversed,
	}));
	for (const { ref, match: green, reversed } of [
		...matchedGreens,
		...pinGreens,
	]) {
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
		const target = geometry.get(
			nearestHoleRef(polygonCentroid(poly), holeLines),
		);
		if (!target) continue;
		if (isWater(el.tags ?? {})) target.water.push(poly);
		else if (golf === "fairway") target.fairways.push(poly);
		else if (golf === "bunker") target.bunkers.push(poly);
		else if (golf === "tee") target.tees.push(poly);
		// rough / path / cartpath / driving_range: dropped by design.
	}

	return { holes, geometry: [...geometry.values()] };
}
