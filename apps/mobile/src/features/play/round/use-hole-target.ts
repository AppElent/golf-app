import type { Club } from "@fairway/core/club-suggest";
import type { LatLng } from "@fairway/core/geo";
import type { HoleAnchors } from "@fairway/core/hole-view";
import { useEffect } from "react";
import { defaultTarget } from "./play-model";
import { useHoleState } from "./use-hole-state";

export function useHoleTarget({
	holeKey,
	anchors,
	player,
	fix,
	bag,
}: {
	holeKey: string;
	anchors: HoleAnchors | null;
	player: LatLng | null;
	fix: LatLng | null;
	bag: ReadonlyArray<Club>;
}) {
	const [target, setTarget] = useHoleState<LatLng | null>(holeKey, () =>
		anchors && player ? defaultTarget(player, anchors.green, bag) : null,
	);
	const aimFrom = (from: LatLng) => {
		if (anchors) setTarget(defaultTarget(from, anchors.green, bag));
	};
	const located = fix !== null;
	// Play opened mid-hole would otherwise draw the line backwards.
	// biome-ignore lint/correctness/useExhaustiveDependencies: on gaining a fix only
	useEffect(() => {
		if (fix) aimFrom(fix);
	}, [located]);
	return { target, setTarget, aimFrom };
}
