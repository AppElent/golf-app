import {
	haversineMeters,
	type LatLng,
	pointAlongPolyline,
	polylineLength,
} from "./geo";
import { type HoleAnchors, lineOfPlay } from "./hole-view";

/** Places to jump to in simulation mode. */
export type SimulationSpot = "tee" | "approach" | "green";

/** The classic approach yardage: 100 m from the green along the line of play. */
const APPROACH_METERS = 100;

/** Meters per simulated walking step: a brisk pace, sped up for testing. */
export const WALK_STEP_METERS = 8;
export const WALK_STEP_MS = 400;

export function simulationSpot(
	spot: SimulationSpot,
	anchors: Pick<HoleAnchors, "tee" | "green">,
	holeLine: ReadonlyArray<LatLng> | undefined,
): LatLng {
	if (spot === "tee") return anchors.tee;
	if (spot === "green") return anchors.green;
	const line = lineOfPlay(anchors.tee, anchors.green, holeLine);
	return pointAlongPolyline(
		line,
		Math.max(0, polylineLength(line) - APPROACH_METERS),
	);
}

/** One walking step along the line of play. Stops at the green. */
export function walkStep(
	position: LatLng,
	green: LatLng,
	holeLine: ReadonlyArray<LatLng> | undefined,
	meters = WALK_STEP_METERS,
): LatLng {
	if (haversineMeters(position, green) <= meters) return green;
	return pointAlongPolyline(lineOfPlay(position, green, holeLine), meters);
}
