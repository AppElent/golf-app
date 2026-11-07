import { haversineMeters, type LatLng } from "./geo";
import type { HoleAnchors } from "./hole-view";

type TeeAndGreen = Pick<HoleAnchors, "tee" | "green">;

/** You count as "on the next tee" within this radius of it. */
const TEE_RADIUS_M = 30;
/** …and only once you have left the current green behind by this much. */
const LEFT_GREEN_M = 15;

/**
 * Suggest moving to the next hole: true when the player stands on the next
 * hole's tee and is closer to it than to the current green (so walking past a
 * neighbouring tee mid-hole doesn't trigger it). The UI offers, never forces.
 */
export function shouldAdvance(
	position: LatLng,
	current: TeeAndGreen,
	next: TeeAndGreen | undefined,
	accuracyMeters = 0,
): boolean {
	if (!next) return false;
	const toNextTee = haversineMeters(position, next.tee);
	const toGreen = haversineMeters(position, current.green);
	return (
		toNextTee <= TEE_RADIUS_M + Math.min(accuracyMeters, 20) &&
		toNextTee < toGreen &&
		toGreen > LEFT_GREEN_M
	);
}
