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
	locateOnPolyline,
	polygonCentroid,
	polylineCrossesRing,
} from "./geo";

/** One tee position: where the listed tee colors (`tee.marker`) play from. */
export interface TeeBox {
	position: LatLng;
	colors: string[];
}

/** A hole's renderable geometry in WGS84 (consumers project via a Projector). */
export interface HoleGeometry {
	holeLine?: LatLng[];
	fairways: LatLng[][];
	greens: LatLng[][];
	bunkers: LatLng[][];
	water: LatLng[][];
	tees: LatLng[][];
	teeBoxes?: TeeBox[];
}

export interface HoleAnchors {
	tee: LatLng;
	green: LatLng;
	greenRing: LatLng[] | null;
}

/** Where a tee color plays from: its own box, else the hole's back tee. */
function teePosition(
	geo: HoleGeometry,
	green: LatLng,
	marker: string | undefined,
): LatLng | undefined {
	const boxes = geo.teeBoxes ?? [];
	const own = marker ? boxes.find((b) => b.colors.includes(marker)) : undefined;
	if (own) return own.position;
	const rings = geo.tees.filter((r) => r.length > 2).map(polygonCentroid);
	const known = [...boxes.map((b) => b.position), ...rings];
	if (known.length === 0) return geo.holeLine?.[0];
	return known.reduce((back, p) =>
		haversineMeters(p, green) > haversineMeters(back, green) ? p : back,
	);
}

/** Green = first green centroid, else the hole line's end. Tee = the box of the
 *  played tee color (`marker`), else the farthest known tee, else the hole
 *  line's start. Null when either is unknown. */
export function holeAnchors(
	geo: HoleGeometry,
	marker?: string,
): HoleAnchors | null {
	const line = geo.holeLine ?? [];
	const greenRing = geo.greens.find((r) => r.length > 2) ?? null;
	const green = greenRing
		? polygonCentroid(greenRing)
		: line.length > 1
			? line[line.length - 1]
			: undefined;
	if (!green) return null;
	const tee = teePosition(geo, green, marker);
	if (!tee) return null;
	return { tee, green, greenRing };
}

export type HazardKind = "water" | "bunker";

/** Side of the line of play, as the player looks toward the green. */
export type HazardSide = "left" | "right" | "center";

export interface HazardInPlay {
	kind: HazardKind;
	/** Distance to its nearest edge — what it takes to reach it. */
	reach: number;
	/** Distance to its farthest edge — what it takes to carry it. */
	carry: number;
	/** Label anchor: the bunker's centroid, the water's edge nearest the line
	 *  of play (a pond or ditch can run far beyond this hole). */
	at: LatLng;
	side: HazardSide;
}

/** Further than this from the line of play, a hazard is another hole's. */
const MAX_OFFSET_M = 45;
/** A hazard this close behind the green is still the green's. */
const BEHIND_GREEN_M = 25;

/** The line of play from `position` on: the hole line past it, or straight. */
export function lineOfPlay(
	position: LatLng,
	green: LatLng,
	holeLine: ReadonlyArray<LatLng> | undefined,
): LatLng[] {
	if (!holeLine || holeLine.length < 2) return [position, green];
	const from = locateOnPolyline(position, holeLine).along;
	let walked = 0;
	const rest: LatLng[] = [];
	for (let i = 0; i < holeLine.length; i++) {
		if (i > 0) walked += haversineMeters(holeLine[i - 1], holeLine[i]);
		if (walked > from) rest.push(holeLine[i]);
	}
	return [position, ...rest, green];
}

/** Ditches are mapped in pieces: read touching pieces as the one hazard. */
function mergeWater(hazards: readonly HazardInPlay[]): HazardInPlay[] {
	const merged: HazardInPlay[] = [];
	for (const hazard of hazards) {
		const previous = [...merged]
			.reverse()
			.find((h) => h.kind === "water" && h.side === hazard.side);
		if (
			hazard.kind === "water" &&
			previous &&
			hazard.reach <= previous.carry + 5
		) {
			previous.carry = Math.max(previous.carry, hazard.carry);
		} else {
			merged.push({ ...hazard });
		}
	}
	return merged;
}

/**
 * Hazards ahead of you on the line of play, up to just behind the green,
 * reachable within `maxMeters`. Nearest first. Follows the hole line, so the
 * hazards of a dogleg's far leg count, and neighbouring holes' hazards do not.
 */
export function hazardsInPlay(
	position: LatLng,
	green: LatLng,
	geo: Pick<HoleGeometry, "water" | "bunkers" | "holeLine">,
	{ maxMeters = 330, limit = 4 }: { maxMeters?: number; limit?: number } = {},
): HazardInPlay[] {
	const line = lineOfPlay(position, green, geo.holeLine);
	const toGreen = locateOnPolyline(green, line).along;
	const rings: Array<[HazardKind, LatLng[]]> = [
		...geo.water.map((r): [HazardKind, LatLng[]] => ["water", r]),
		...geo.bunkers.map((r): [HazardKind, LatLng[]] => ["bunker", r]),
	];
	const found = rings
		.filter(([, ring]) => ring.length > 2)
		.flatMap(([kind, ring]): HazardInPlay[] => {
			const fixes = ring.map((p) => ({ p, fix: locateOnPolyline(p, line) }));
			const { p: closest, fix } = fixes.reduce((a, b) =>
				b.fix.offset < a.fix.offset ? b : a,
			);
			const behindYou = fixes.every((f) => f.fix.along === 0);
			const pastGreen = fix.along >= toGreen && fix.offset > BEHIND_GREEN_M;
			if (behindYou || pastGreen || fix.offset > MAX_OFFSET_M) return [];
			return [
				{
					kind,
					...carryDistances(position, ring),
					at: kind === "water" ? closest : polygonCentroid(ring),
					side: polylineCrossesRing(line, ring) ? "center" : fix.side,
				},
			];
		})
		.filter((h) => h.reach <= maxMeters)
		.sort((a, b) => a.reach - b.reach);
	return mergeWater(found).slice(0, limit);
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
