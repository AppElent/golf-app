import type { LatLng } from "@fairway/core/geo";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Gesture } from "react-native-gesture-handler";
import type MapView from "react-native-maps";
import type { Camera } from "react-native-maps";
import { haptics } from "../../../feedback/haptics";
import { loupeCamera, toCoord } from "./hole-camera";

export type Point = { x: number; y: number };

/**
 * Drag handle state: where the target sits on screen (the handle follows it)
 * and the finger while dragging (the loupe floats above it).
 */
export function useTargetDrag({
	map,
	target,
	height,
	onTargetChange,
}: {
	map: RefObject<MapView | null>;
	target: LatLng;
	height: number;
	onTargetChange: (target: LatLng) => void;
}) {
	const loupeMap = useRef<MapView>(null);
	const [targetPoint, setTargetPoint] = useState<Point | null>(null);
	const [finger, setFinger] = useState<Point | null>(null);
	const drag = useRef<{ start: Point; camera: Camera } | null>(null);

	const placeHandle = () => {
		map.current
			?.pointForCoordinate(toCoord(target))
			.then(setTargetPoint)
			.catch(() => {});
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: follows the target
	useEffect(placeHandle, [target.lat, target.lng, height]);

	const moveTo = (point: Point) => {
		setFinger(point);
		map.current
			?.coordinateForPoint(point)
			.then((c) => {
				const next = { lat: c.latitude, lng: c.longitude };
				onTargetChange(next);
				const camera = drag.current?.camera;
				if (camera) loupeMap.current?.setCamera(loupeCamera(camera, next));
			})
			.catch(() => {});
	};
	const pan = Gesture.Pan()
		.runOnJS(true)
		.minDistance(0)
		.onBegin(() => {
			if (!targetPoint) return;
			haptics.selectionChanged();
			map.current
				?.getCamera()
				.then((camera) => {
					drag.current = { start: targetPoint, camera };
					loupeMap.current?.setCamera(loupeCamera(camera, target));
					setFinger(targetPoint);
				})
				.catch(() => {});
		})
		.onUpdate((e) => {
			const start = drag.current?.start;
			if (start)
				moveTo({ x: start.x + e.translationX, y: start.y + e.translationY });
		})
		.onFinalize(() => {
			drag.current = null;
			setFinger(null);
			placeHandle();
		});

	return {
		loupeMap,
		targetPoint,
		finger,
		pan,
		placeHandle,
		onRegionChange: drag.current ? undefined : placeHandle,
	};
}
