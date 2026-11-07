/**
 * What the on-course hole view needs from a hole's raw geometry: where the
 * tee and green are, which hazards are in play from where you stand, and the
 * F/C/B numbers. Pure; both the satellite and the schematic canvas use it.
 */
import {
	carryDistances,
	distancesToGreen,
	haversineMeters,
	type LatLng,
	polygonCentroid,
	projectToLocal,
} from "./geo";

/** A hole's renderable geometry in WGS84 (consumers project via a Projector). */
export interface HoleGeometry {
	holeLine?: LatLng[];
	fairways: LatLng[][];
	greens: LatLng[][];
	bunkers: LatLng[][];
	water: LatLng[][];
	tees: LatLng[][];
}

export interface HoleAnchors {
	tee: LatLng;
	green: LatLng;
	greenRing: LatLng[] | null;
}

/** Tee = first tee box centroid, else the hole line's start; green = first
 *  green centroid, else the hole line's end. Null when neither exists. */
export function holeAnchors(geo: HoleGeometry): HoleAnchors | null {
	const line = geo.holeLine ?? [];
	const greenRing = geo.greens.find((r) => r.length > 2) ?? null;
	const teeRing = geo.tees.find((r) => r.length > 2);
	const tee = teeRing ? polygonCentroid(teeRing) : line[0];
	const green = greenRing
		? polygonCentroid(greenRing)
		: line.length > 1
			? line[line.length - 1]
			: undefined;
	if (!tee || !green) return null;
	return { tee, green, greenRing };
}

export type HazardKind = "water" | "bunker";

export interface HazardInPlay {
	kind: HazardKind;
	/** Distance to its nearest edge — what it takes to reach it. */
	reach: number;
	/** Distance to its farthest edge — what it takes to carry it. */
	carry: number;
	/** Label anchor: the hazard's centroid. */
	at: LatLng;
}

/**
 * Hazards between you and the green: ahead of you along the you→green axis,
 * not beyond the green, reachable within `maxMeters`. Nearest first.
 */
export function hazardsInPlay(
	position: LatLng,
	green: LatLng,
	geo: Pick<HoleGeometry, "water" | "bunkers">,
	{ maxMeters = 330, limit = 4 }: { maxMeters?: number; limit?: number } = {},
): HazardInPlay[] {
	const axis = projectToLocal(position, green);
	const length = Math.hypot(axis.x, axis.y) || 1;
	const along = (p: LatLng) => {
		const l = projectToLocal(position, p);
		return (l.x * axis.x + l.y * axis.y) / length;
	};
	const rings: Array<[HazardKind, LatLng[]]> = [
		...geo.water.map((r): [HazardKind, LatLng[]] => ["water", r]),
		...geo.bunkers.map((r): [HazardKind, LatLng[]] => ["bunker", r]),
	];
	return rings
		.filter(([, ring]) => ring.length > 2)
		.map(([kind, ring]) => ({
			kind,
			...carryDistances(position, ring),
			at: polygonCentroid(ring),
			ahead: along(polygonCentroid(ring)),
		}))
		.filter((h) => h.ahead > 0 && h.ahead <= length + 5 && h.reach <= maxMeters)
		.sort((a, b) => a.reach - b.reach)
		.slice(0, limit)
		.map(({ ahead: _ahead, ...h }) => h);
}

export interface HoleNumbers {
	front: number;
	center: number;
	back: number;
}

/** F/C/B to the green polygon, or center-only (as all three) to a bare point. */
export function greenNumbers(
	position: LatLng,
	anchors: HoleAnchors,
): HoleNumbers {
	if (anchors.greenRing) return distancesToGreen(position, anchors.greenRing);
	const d = haversineMeters(position, anchors.green);
	return { front: d, center: d, back: d };
}
