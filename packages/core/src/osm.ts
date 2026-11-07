import {
	EARTH_RADIUS_M,
	haversineMeters,
	type LatLng,
	locateOnPolyline,
	polygonCentroid,
	projectToLocal,
	toRad,
} from "./geo.ts";
import type { HoleGeometry, TeeBox } from "./hole-view.ts";

export interface NormalizedHole {
	number: number;
	ref: string;
	line: LatLng[];
}

export interface OsmHoleGeometry extends HoleGeometry {
	ref: string;
	holeNumber: number;
	holeLine: LatLng[];
	teeBoxes: TeeBox[];
}

export interface NormalizedCourse {
	holes: NormalizedHole[];
	geometry: OsmHoleGeometry[];
}

/**
 * A reviewed correction to one hole, for what OpenStreetMap lacks: positions
 * read off the aerial photo and checked against the club's scorecard.
 */
export interface HoleOverride {
	/** The real line of play, tee to green, with its doglegs. */
	holeLine?: LatLng[];
	/** Replaces every tee box OSM has for the hole. */
	teeBoxes?: TeeBox[];
	/** The green's outline, for a hole OSM has none for. */
	green?: LatLng[];
	/** Water OSM lacks, added to the hole's. */
	water?: LatLng[][];
	/** Bunkers OSM lacks, added to the hole's. */
	bunkers?: LatLng[][];
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
interface OverpassMember {
	type: string;
	role?: string;
	geometry?: OverpassGeom[];
}
interface OverpassElement {
	type: string;
	id: number;
	tags?: Tags;
	geometry?: OverpassGeom[];
	/** Relations (multipolygons) carry their ways as members. */
	members?: OverpassMember[];
	/** Nodes (`golf=pin`, `golf=tee`) carry a position instead of a geometry. */
	lat?: number;
	lon?: number;
}

const toLatLng = (g: OverpassGeom): LatLng => ({ lat: g.lat, lng: g.lon });
const geomOf = (el: OverpassElement): LatLng[] =>
	(el.geometry ?? []).map(toLatLng);

const samePoint = (a: LatLng, b: LatLng) => a.lat === b.lat && a.lng === b.lng;

/** Join a multipolygon's outer ways into closed rings. */
function outerRings(el: OverpassElement): LatLng[][] {
	const open = (el.members ?? [])
		.filter((m) => m.type === "way" && m.role !== "inner" && m.geometry)
		.map((m) => (m.geometry as OverpassGeom[]).map(toLatLng));
	const rings: LatLng[][] = [];
	while (open.length > 0) {
		let ring = open.shift() as LatLng[];
		for (
			let found = true;
			found && !samePoint(ring[0], ring.at(-1) as LatLng);
		) {
			found = false;
			const end = ring.at(-1) as LatLng;
			const next = open.findIndex(
				(way) => samePoint(way[0], end) || samePoint(way.at(-1) as LatLng, end),
			);
			if (next >= 0) {
				const [way] = open.splice(next, 1);
				const forward = samePoint(way[0], end) ? way : [...way].reverse();
				ring = [...ring, ...forward.slice(1)];
				found = true;
			}
		}
		rings.push(ring);
	}
	return rings;
}

const polygonsOf = (el: OverpassElement): LatLng[][] =>
	el.type === "relation" ? outerRings(el) : [geomOf(el)];

/** A long, thin polygon around a line: how a ditch (mapped as a line) is drawn
 *  and measured alongside the ponds. */
function stripAround(line: ReadonlyArray<LatLng>, widthM: number): LatLng[] {
	const origin = line[0];
	const dLat = (widthM / 2 / EARTH_RADIUS_M) * (180 / Math.PI);
	const dLng = dLat / Math.cos(toRad(origin.lat));
	const offsets = line.map((p, i) => {
		const a = projectToLocal(origin, line[Math.max(0, i - 1)]);
		const b = projectToLocal(origin, line[Math.min(line.length - 1, i + 1)]);
		const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
		return { p, nx: -(b.y - a.y) / len, ny: (b.x - a.x) / len };
	});
	const side = (sign: number) => (o: (typeof offsets)[number]) => ({
		lat: o.p.lat + sign * o.ny * dLat,
		lng: o.p.lng + sign * o.nx * dLng,
	});
	return [...offsets.map(side(1)), ...[...offsets].reverse().map(side(-1))];
}

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

/** Shortest distance from a hole line to a feature: 0 when the line runs over
 *  it. Rough for a sparse ring, which golf features are not. */
function lineToRing(
	line: ReadonlyArray<LatLng>,
	ring: ReadonlyArray<LatLng>,
): number {
	return Math.min(
		...ring.map((p) => locateOnPolyline(p, line).offset),
		...line.map((p) => distanceToRing(p, ring)),
	);
}

/** Pairs a feature with the hole it lies along: its mean distance to the line. */
function meanOffset(
	line: ReadonlyArray<LatLng>,
	ring: ReadonlyArray<LatLng>,
): number {
	return (
		ring.reduce((sum, p) => sum + locateOnPolyline(p, line).offset, 0) /
		ring.length
	);
}

/** A green further than this from every hole's end is a practice green. */
const GREEN_MATCH_METERS = 60;

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

const isWaterArea = (tags: Tags | undefined): boolean =>
	tags !== undefined &&
	(tags.golf === "water_hazard" ||
		tags.golf === "lateral_water_hazard" ||
		tags.natural === "water");

/** Open water mapped as a line; a culvert under a fairway is not in play. */
const isDitch = (el: OverpassElement): boolean =>
	el.type === "way" &&
	(el.tags?.waterway === "ditch" ||
		el.tags?.waterway === "stream" ||
		el.tags?.waterway === "drain") &&
	el.tags?.tunnel === undefined;

const DITCH_WIDTH_M = 3;
/** Hazards this close to a hole's line are in play on it, whichever hole they
 *  are nearest: a pond between two fairways belongs to both. */
const WATER_CORRIDOR_M = 40;
const BUNKER_CORRIDOR_M = 30;
/** A tee further than this from every hole's start is not a tee of this course. */
const TEE_MATCH_METERS = 130;
/** A tee node on a mapped tee polygon marks the same box. */
const TEE_NODE_ON_BOX_M = 8;

/** The holes a hazard is in play on, or the single nearest when it's on none. */
function holesAlong(
	ring: ReadonlyArray<LatLng>,
	holeLines: ReadonlyArray<{ ref: string; line: LatLng[] }>,
	corridor: number,
): string[] {
	const distances = holeLines
		.filter((h) => h.line.length > 1)
		.map((h) => ({ ref: h.ref, d: lineToRing(h.line, ring) }));
	const along = distances.filter((h) => h.d <= corridor).map((h) => h.ref);
	if (along.length > 0) return along;
	const nearest = distances.reduce((a, b) => (b.d < a.d ? b : a), distances[0]);
	return nearest ? [nearest.ref] : [];
}

const teeColors = (tags: Tags | undefined): string[] =>
	(tags?.tee ?? "")
		.split(";")
		.map((color) => color.trim())
		.filter(Boolean);

/**
 * Turn raw Overpass elements (from `out geom tags` over a course area) into
 * normalized holes + per-hole geometry, keyed by ref. Fairways go to the hole
 * they lie along, tees to the hole starting nearest, water and bunkers to every
 * hole they are in play on. `rough`, paths, and driving ranges are intentionally
 * dropped. Only geometry comes from OSM: par, stroke index and lengths are
 * curated in convex/catalog; `overrides` replace what OSM has wrong or lacks.
 */
export function normalizeCourse(
	elements: ReadonlyArray<OverpassElement>,
	overrides: Readonly<Record<string, HoleOverride>> = {},
): NormalizedCourse {
	const holeElements = elements.filter((e) => e.tags?.golf === "hole");

	// Unnumbered `golf=hole` ways (ref absent/non-numeric) are stray geometry,
	// not scorecard holes — drop them so they neither appear nor attract features.
	const holes: NormalizedHole[] = holeElements
		.map((el) => ({ ...parseHoleRef(el.tags?.ref), line: geomOf(el) }))
		.filter((h) => h.number >= 1)
		.map((h) => ({ ...h, line: overrides[h.ref]?.holeLine ?? h.line }));

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
				teeBoxes: [],
				water: [],
			});
		}
	}

	const holeLines = holes.map((h) => ({ ref: h.ref, line: h.line }));

	// Greens are matched to the hole line that ends on them, one green per
	// hole: anything looser hands practice greens and the green of a hole running
	// past to the wrong hole.
	const greens = elements.filter(
		(el) =>
			el.tags?.golf === "green" &&
			!isWaterArea(el.tags) &&
			geomOf(el).length > 2,
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

	// Everything below reads the lines tee → green.
	const directed = [...geometry.values()].map((g) => ({
		ref: g.ref,
		line: g.holeLine,
	}));

	const assignTee = (position: LatLng, ring: LatLng[] | null, tags?: Tags) => {
		let best: { ref: string; d: number } | null = null;
		for (const { ref, line } of directed) {
			const d = haversineMeters(position, line[0]);
			if (d <= TEE_MATCH_METERS && (!best || d < best.d)) best = { ref, d };
		}
		if (!best) return;
		const target = geometry.get(best.ref);
		if (!target) return;
		if (ring) target.tees.push(ring);
		target.teeBoxes.push({ position, colors: teeColors(tags) });
	};

	const teeRings = elements.filter(
		(el) => el.tags?.golf === "tee" && el.type !== "node",
	);
	const ringList = teeRings.flatMap(polygonsOf).filter((r) => r.length > 2);
	teeRings.forEach((el) => {
		for (const ring of polygonsOf(el)) {
			if (ring.length > 2) assignTee(polygonCentroid(ring), ring, el.tags);
		}
	});
	for (const el of elements) {
		if (el.type !== "node" || el.tags?.golf !== "tee") continue;
		if (el.lat === undefined || el.lon === undefined) continue;
		const position = { lat: el.lat, lng: el.lon };
		const onBox = ringList.some(
			(ring) => distanceToRing(position, ring) <= TEE_NODE_ON_BOX_M,
		);
		if (!onBox) assignTee(position, null, el.tags);
	}

	for (const el of elements) {
		const golf = el.tags?.golf;
		if (isDitch(el)) {
			const line = geomOf(el);
			if (line.length < 2) continue;
			const strip = stripAround(line, DITCH_WIDTH_M);
			const along = directed
				.filter((h) => lineToRing(h.line, strip) <= WATER_CORRIDOR_M)
				.map((h) => h.ref);
			for (const ref of along) geometry.get(ref)?.water.push(strip);
			continue;
		}
		if (isWaterArea(el.tags) && el.tags?.tunnel === undefined) {
			for (const ring of polygonsOf(el)) {
				if (ring.length < 3) continue;
				const along = directed
					.filter((h) => lineToRing(h.line, ring) <= WATER_CORRIDOR_M)
					.map((h) => h.ref);
				for (const ref of along) geometry.get(ref)?.water.push(ring);
			}
			continue;
		}
		if (golf === "bunker") {
			for (const ring of polygonsOf(el)) {
				if (ring.length < 3) continue;
				for (const ref of holesAlong(ring, directed, BUNKER_CORRIDOR_M)) {
					geometry.get(ref)?.bunkers.push(ring);
				}
			}
			continue;
		}
		if (golf === "fairway") {
			for (const ring of polygonsOf(el)) {
				if (ring.length < 3 || directed.length === 0) continue;
				const nearest = directed.reduce((a, b) =>
					meanOffset(b.line, ring) < meanOffset(a.line, ring) ? b : a,
				);
				geometry.get(nearest.ref)?.fairways.push(ring);
			}
		}
		// rough / path / cartpath / driving_range: dropped by design.
	}

	for (const [ref, override] of Object.entries(overrides)) {
		const target = geometry.get(ref);
		if (!target) continue;
		if (override.teeBoxes) target.teeBoxes = override.teeBoxes;
		if (override.green) target.greens = [override.green];
		target.water.push(...(override.water ?? []));
		target.bunkers.push(...(override.bunkers ?? []));
	}

	return { holes, geometry: [...geometry.values()] };
}
