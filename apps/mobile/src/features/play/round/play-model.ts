/**
 * Play-screen decisions that are not drawing: where the target starts, and
 * how a distance (plus club) reads on the imagery.
 */
import { type Club, suggestClub } from "@fairway/core/club-suggest";
import { metersToYards, type Units } from "@fairway/core/format";
import { haversineMeters, interpolate, type LatLng } from "@fairway/core/geo";

/**
 * Golfshot's default: the green when it is in reach of your longest club,
 * otherwise a lay-up point that far down the you → green line.
 */
export function defaultTarget(
	from: LatLng,
	green: LatLng,
	bag: ReadonlyArray<Club>,
): LatLng {
	const toGreen = haversineMeters(from, green);
	const longest = Math.max(0, ...bag.map((c) => c.carryMeters));
	if (longest === 0 || toGreen <= longest + 10) return green;
	return interpolate(from, green, longest / toGreen);
}

/** "152" in the chosen units — the unit is shown once, not on every number. */
export function distanceNumber(meters: number, units: Units): string {
	return String(Math.round(units === "yd" ? metersToYards(meters) : meters));
}

/** "152 · 7i": the leg length with the club that carries it. */
export function legLabel(
	meters: number,
	units: Units,
	bag: ReadonlyArray<Club>,
	withClub: boolean,
): string {
	const club = withClub ? suggestClub(bag, meters) : null;
	const n = distanceNumber(meters, units);
	return club ? `${n} · ${club.name}` : n;
}

/** Slack beyond the hole's own length (a wayward drive, the walk to the tee). */
const ON_HOLE_SLACK_M = 120;

/**
 * Whether a GPS fix belongs to this hole: no further from the green than the
 * hole is long, plus slack. Elsewhere on the course (or at home) distances
 * come from the tee instead of drawing a line across other holes.
 */
export function isOnHole(
	position: LatLng,
	anchors: { tee: LatLng; green: LatLng },
): boolean {
	const length = haversineMeters(anchors.tee, anchors.green);
	return haversineMeters(position, anchors.green) <= length + ON_HOLE_SLACK_M;
}
