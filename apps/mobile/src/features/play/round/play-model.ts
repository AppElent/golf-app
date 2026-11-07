import { type Club, suggestClub } from "@fairway/core/club-suggest";
import { distanceValue, holeLabel, type Units } from "@fairway/core/format";
import {
	GPS_WEAK_ACCURACY_M,
	haversineMeters,
	interpolate,
	type LatLng,
} from "@fairway/core/geo";
import type { HazardInPlay, HoleAnchors } from "@fairway/core/hole-view";
import type { LiveHole } from "../../live/hole/live-hole";

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

/** "152 · 7i": the leg length with the club that carries it. */
export function legLabel(
	meters: number,
	units: Units,
	bag: ReadonlyArray<Club>,
	withClub: boolean,
): string {
	const club = withClub ? suggestClub(bag, meters) : null;
	const n = distanceValue(meters, units);
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

/**
 * Where distances are measured from. GPS counts as a `fix` only on (or near)
 * this hole; without one, the tee. A `chosen` spot (simulation mode) counts
 * wherever it is.
 */
export function playerPosition(
	position: LatLng | null,
	anchors: { tee: LatLng; green: LatLng } | null,
	chosen = false,
): { fix: LatLng | null; player: LatLng | null } {
	const fix =
		position && anchors && (chosen || isOnHole(position, anchors))
			? position
			: null;
	return { fix, player: anchors ? (fix ?? anchors.tee) : null };
}

export function hazardLabel(hazard: HazardInPlay, units: Units): string {
	return `${hazard.kind === "water" ? "W" : "B"} ${distanceValue(hazard.reach, units)}/${distanceValue(hazard.carry, units)}`;
}

export type GpsNotice =
	| { kind: "offHole" | "noGps" }
	| { kind: "weak"; meters: number };

/** What the player should know about their fix, if anything. */
export function gpsNotice({
	hasAnchors,
	located,
	hasFix,
	accuracyMeters,
}: {
	hasAnchors: boolean;
	located: boolean;
	hasFix: boolean;
	accuracyMeters: number | null;
}): GpsNotice | null {
	if (!located && hasAnchors) return { kind: hasFix ? "offHole" : "noGps" };
	return accuracyMeters && accuracyMeters > GPS_WEAK_ACCURACY_M
		? { kind: "weak", meters: Math.round(accuracyMeters) }
		: null;
}

/**
 * What the Lock Screen shows for this hole. Null with "GPS while locked" off:
 * nothing would update it while locked, and stale distances mislead.
 */
export function lockScreenHole({
	preferred,
	anchors,
	title,
	holeRef,
	detail,
	units,
	labels,
	url,
}: {
	preferred: boolean;
	anchors: HoleAnchors;
	title: string;
	holeRef: string;
	detail: string;
	units: Units;
	labels: { front: string; center: string; back: string };
	url: string;
}): LiveHole | null {
	if (!preferred) return null;
	return {
		anchors,
		props: {
			hole: title,
			holeShort: holeLabel(holeRef),
			detail,
			unit: units,
			frontLabel: labels.front,
			centerLabel: labels.center,
			backLabel: labels.back,
		},
		format: (meters) => distanceValue(meters, units),
		url,
		accepts: (fix) => isOnHole(fix, anchors),
	};
}
