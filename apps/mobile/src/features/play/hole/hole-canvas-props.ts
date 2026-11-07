import type { LatLng } from "@fairway/core/geo";
import type { HazardInPlay, HoleGeometry } from "@fairway/core/hole-view";

/** Everything a hole canvas draws. Distances are precomputed by the screen. */
export interface HoleCanvasProps {
	geometry: HoleGeometry;
	green: LatLng;
	/** Where distances are measured from: GPS, or the tee without a fix. */
	player: LatLng;
	/** True when `player` is a real GPS fix (draws the blue dot). */
	located: boolean;
	target: LatLng;
	onTargetChange: (target: LatLng) => void;
	/** Formatted labels for the two legs of the target line. */
	toTargetLabel: string;
	/** Null when the target is on the green (no second leg). */
	targetToGreenLabel: string | null;
	hazards: readonly HazardInPlay[];
	hazardLabel: (hazard: HazardInPlay) => string;
	/** Green view: zoom to the green instead of the whole hole. */
	greenView: boolean;
	/** Shots marked on this hole, in order (the trail drawn to the ball). */
	shots: readonly LatLng[];
	/** Space the HUD covers, so the hole fits between the bars. */
	insets: { top: number; bottom: number; left: number; right: number };
}
