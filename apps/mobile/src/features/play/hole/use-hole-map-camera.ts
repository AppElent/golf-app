import { type RefObject, useEffect } from "react";
import { Platform } from "react-native";
import type MapView from "react-native-maps";
import type { Camera } from "react-native-maps";
import { holeCamera, toCoord } from "./hole-camera";
import type { HoleCanvasProps } from "./hole-canvas-props";

/** Frames the map on the hole; returns the camera for the map's first mount. */
export function useHoleMapCamera({
	map,
	player,
	green,
	located,
	greenView,
	insets,
	height,
}: Pick<
	HoleCanvasProps,
	"player" | "green" | "located" | "greenView" | "insets"
> & {
	map: RefObject<MapView | null>;
	height: number;
}): Camera {
	const camera = holeCamera({
		from: player,
		green,
		height,
		insets,
		greenView,
		paddingFramesCamera: Platform.OS === "android",
	});
	const mapCamera: Camera = {
		center: toCoord(camera.center),
		heading: camera.heading,
		pitch: 0,
		zoom: camera.zoom,
		altitude: camera.altitude,
	};
	// Re-frame on hole change / view toggle / first fix, not on every GPS tick.
	const frameKey = `${green.lat},${green.lng},${greenView},${height > 0},${located}`;
	// biome-ignore lint/correctness/useExhaustiveDependencies: frameKey is the trigger
	useEffect(() => {
		if (height === 0) return;
		map.current?.animateCamera(mapCamera, { duration: 450 });
	}, [frameKey]);
	return mapCamera;
}
