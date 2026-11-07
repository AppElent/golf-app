import { type LatLng, labelSpot } from "@fairway/core/geo";
import type { HazardInPlay } from "@fairway/core/hole-view";

export function holeOverlays({
	shots,
	player,
	located,
	hazards,
	target,
	green,
}: {
	shots: readonly LatLng[];
	player: LatLng;
	located: boolean;
	hazards: readonly HazardInPlay[];
	target: LatLng;
	green: LatLng;
}) {
	// Distance labels step aside for the hazard callouts.
	const hazardSpots = hazards.map((h) => h.at);
	return {
		/** Shot to shot, then on to the ball when there is a fix. */
		trail: located ? [...shots, player] : shots,
		toTargetSpot: labelSpot(player, target, hazardSpots),
		toGreenSpot: labelSpot(target, green, hazardSpots),
	};
}
