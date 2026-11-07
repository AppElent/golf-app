import type { LatLng } from "@fairway/core/geo";
import type { HoleAnchors, HoleGeometry } from "@fairway/core/hole-view";
import {
	type SimulationSpot,
	simulationSpot,
	WALK_STEP_MS,
	walkStep,
} from "@fairway/core/simulation";
import { useEffect, useState } from "react";
import { useHoleState } from "./use-hole-state";

/** A simulated fix is as good as GPS gets. */
export const SIMULATED_ACCURACY_M = 3;

/** Where simulation mode stands the player: on this hole's tee to begin with. */
export function useSimulatedPosition({
	holeKey,
	anchors,
	geometry,
	nextAnchors,
}: {
	holeKey: string;
	anchors: HoleAnchors | null;
	geometry: HoleGeometry | null;
	nextAnchors: HoleAnchors | null;
}) {
	const [position, setPosition] = useHoleState<LatLng | null>(
		holeKey,
		() => anchors?.tee ?? null,
	);
	const [walking, setWalking] = useHoleState(holeKey, () => false);
	const [moving, setMoving] = useState(false);

	const green = anchors?.green;
	const holeLine = geometry?.holeLine;
	useEffect(() => {
		if (!walking || !green) return;
		const timer = setInterval(() => {
			setPosition((from) => from && walkStep(from, green, holeLine));
		}, WALK_STEP_MS);
		return () => clearInterval(timer);
	}, [walking, green, holeLine, setPosition]);

	const arrived =
		!!position &&
		!!green &&
		position.lat === green.lat &&
		position.lng === green.lng;
	if (walking && arrived) setWalking(false);

	return {
		position,
		walking,
		moving,
		setMoving,
		moveTo: setPosition,
		toggleWalking: () => setWalking((on) => !on),
		stopWalking: () => setWalking(false),
		spot: (spot: SimulationSpot) =>
			anchors ? simulationSpot(spot, anchors, holeLine) : null,
		nextTee: nextAnchors?.tee ?? null,
	};
}
