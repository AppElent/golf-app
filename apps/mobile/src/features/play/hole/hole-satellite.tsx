/**
 * Satellite hole view (Apple Maps on iOS, Google Maps on Android): imagery
 * rotated tee → green with the Golfshot overlays — yellow target line, a
 * draggable target, distance labels on each leg and hazard numbers. Tap the
 * map to move the target, or drag it: a magnifier above the finger shows the
 * exact spot (the lip of a bunker, a part of the green) the finger covers.
 * Rotation and tilt are locked; pinch and pan are not.
 */
import { type LatLng, labelSpot } from "@fairway/core/geo";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import MapView, { type Camera, Marker, Polyline } from "react-native-maps";
import { haptics } from "../../../feedback/haptics";
import { course, type as typeRamp } from "../../../theme";
import { holeCamera } from "./hole-camera";
import type { HoleCanvasProps } from "./hole-canvas-props";

const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

export function HoleSatellite(props: HoleCanvasProps) {
	const {
		tee,
		green,
		player,
		located,
		target,
		onTargetChange,
		toTargetLabel,
		targetToGreenLabel,
		hazards,
		hazardLabel,
		greenView,
		insets,
		shots,
	} = props;
	const map = useRef<MapView>(null);
	const loupeMap = useRef<MapView>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const height = size.height;
	// Where the target sits on screen (the drag handle follows it), and the
	// finger while dragging (the loupe floats above it).
	const [targetPoint, setTargetPoint] = useState<Point | null>(null);
	const [finger, setFinger] = useState<Point | null>(null);
	const drag = useRef<{ start: Point; camera: Camera } | null>(null);
	const from = located ? player : tee;
	// Shot to shot, then on to the ball when there is a fix.
	const trail = located ? [...shots, player] : shots;
	// Distance labels step aside for the hazard callouts.
	const hazardSpots = hazards.map((h) => h.at);

	const camera = holeCamera({
		from,
		green,
		height,
		insets,
		greenView,
		paddingFramesCamera: Platform.OS === "android",
	});
	// Re-frame on hole change / view toggle / first fix, not on every GPS tick.
	const frameKey = `${green.lat},${green.lng},${greenView},${height > 0},${located}`;
	// biome-ignore lint/correctness/useExhaustiveDependencies: frameKey is the trigger
	useEffect(() => {
		if (height === 0) return;
		map.current?.animateCamera(
			{
				center: toCoord(camera.center),
				heading: camera.heading,
				pitch: 0,
				zoom: camera.zoom,
				altitude: camera.altitude,
			},
			{ duration: 450 },
		);
	}, [frameKey]);

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
	return (
		<View
			style={StyleSheet.absoluteFill}
			onLayout={(e) =>
				setSize({
					width: e.nativeEvent.layout.width,
					height: e.nativeEvent.layout.height,
				})
			}
		>
			{height > 0 ? (
				<MapView
					ref={map}
					style={StyleSheet.absoluteFill}
					mapType="satellite"
					initialCamera={{
						center: toCoord(camera.center),
						heading: camera.heading,
						pitch: 0,
						zoom: camera.zoom,
						altitude: camera.altitude,
					}}
					mapPadding={insets}
					rotateEnabled={false}
					pitchEnabled={false}
					showsCompass={false}
					showsPointsOfInterests={false}
					showsBuildings={false}
					toolbarEnabled={false}
					moveOnMarkerPress={false}
					onRegionChange={drag.current ? undefined : placeHandle}
					onRegionChangeComplete={placeHandle}
					onPress={(e) =>
						onTargetChange({
							lat: e.nativeEvent.coordinate.latitude,
							lng: e.nativeEvent.coordinate.longitude,
						})
					}
				>
					{trail.length > 1 ? (
						<Polyline
							coordinates={trail.map(toCoord)}
							strokeColor={course.shotLine}
							strokeWidth={2}
							lineDashPattern={[6, 6]}
						/>
					) : null}
					{shots.map((shot, i) => (
						<Marker
							// biome-ignore lint/suspicious/noArrayIndexKey: shots only append; a re-tee can repeat a spot
							key={`shot-${i}`}
							coordinate={toCoord(shot)}
							anchor={{ x: 0.5, y: 0.5 }}
							tracksViewChanges={false}
							tappable={false}
						>
							<View style={styles.shot}>
								<Text style={styles.shotText}>{i + 1}</Text>
							</View>
						</Marker>
					))}
					<Polyline
						coordinates={[from, target, green].map(toCoord)}
						strokeColor={course.targetLine}
						strokeWidth={3}
						lineCap="round"
					/>
					<Marker
						coordinate={toCoord(green)}
						anchor={{ x: 0.5, y: 0.5 }}
						tracksViewChanges={false}
					>
						<View style={styles.pin} />
					</Marker>
					{located ? (
						<Marker
							coordinate={toCoord(player)}
							anchor={{ x: 0.5, y: 0.5 }}
							tracksViewChanges={false}
							// Above the shot markers it usually stands on.
							zIndex={3}
						>
							<View style={styles.playerHalo}>
								<View style={styles.player} />
							</View>
						</Marker>
					) : null}
					<Label
						key={`to-${toTargetLabel}`}
						at={labelSpot(from, target, hazardSpots)}
						text={toTargetLabel}
					/>
					{targetToGreenLabel ? (
						<Label
							key={`rest-${targetToGreenLabel}`}
							at={labelSpot(target, green, hazardSpots)}
							text={targetToGreenLabel}
						/>
					) : null}
					{hazards.map((h) => (
						<Label
							key={`${h.at.lat},${h.at.lng},${hazardLabel(h)}`}
							at={h.at}
							text={hazardLabel(h)}
							small
						/>
					))}
					<Marker
						coordinate={toCoord(target)}
						anchor={{ x: 0.5, y: 0.5 }}
						tracksViewChanges={false}
						tappable={false}
					>
						<View style={styles.target}>
							<View style={styles.targetDot} />
						</View>
					</Marker>
				</MapView>
			) : null}
			{targetPoint ? (
				<GestureDetector gesture={pan}>
					<View
						accessibilityLabel={toTargetLabel}
						style={[
							styles.handle,
							{
								left: targetPoint.x - HANDLE / 2,
								top: targetPoint.y - HANDLE / 2,
							},
						]}
					/>
				</GestureDetector>
			) : null}
			{height > 0 ? (
				<View
					pointerEvents="none"
					style={[
						styles.loupe,
						finger ? loupePosition(finger, size.width) : styles.loupeHidden,
					]}
				>
					<MapView
						ref={loupeMap}
						// Twice the circle, so the map's logo and legal link fall
						// outside the clip.
						style={styles.loupeMap}
						mapType="satellite"
						scrollEnabled={false}
						zoomEnabled={false}
						rotateEnabled={false}
						pitchEnabled={false}
						showsCompass={false}
						showsPointsOfInterests={false}
						showsBuildings={false}
						toolbarEnabled={false}
					/>
					<View style={styles.crossH} />
					<View style={styles.crossV} />
					<View style={styles.loupeDot} />
				</View>
			) : null}
		</View>
	);
}

type Point = { x: number; y: number };

/** The drag handle: a touch target over the target ring. */
const HANDLE = 64;
const LOUPE = 136;
/** How far above the finger the loupe floats, centre to centre. */
const LOUPE_LIFT = 110;

/** The loupe camera: same heading as the hole view, about 4× closer. */
function loupeCamera(camera: Camera, at: LatLng): Partial<Camera> {
	return {
		center: toCoord(at),
		heading: camera.heading,
		pitch: 0,
		zoom: camera.zoom === undefined ? undefined : camera.zoom + 2,
		altitude: camera.altitude === undefined ? undefined : camera.altitude / 4,
	};
}

/** Above the finger, or below it near the top edge; kept on screen. */
function loupePosition(finger: Point, width: number) {
	const above = finger.y - LOUPE_LIFT - LOUPE / 2;
	const top = above > 8 ? above : finger.y + LOUPE_LIFT - LOUPE / 2;
	const left = Math.min(
		Math.max(finger.x - LOUPE / 2, 8),
		Math.max(8, width - LOUPE - 8),
	);
	return { top, left };
}

/** A distance label floating over the imagery. Remounts when its text changes
 *  (the `key` at each call site), tracks view changes until its auto-sized
 *  pill has laid out — snapshotted earlier it draws at zero size — then stops
 *  for speed. */
function Label({
	at,
	text,
	small,
}: {
	at: LatLng;
	text: string;
	small?: boolean;
}) {
	const [tracking, setTracking] = useState(true);
	return (
		<Marker
			coordinate={toCoord(at)}
			anchor={{ x: 0.5, y: 0.5 }}
			tracksViewChanges={tracking}
			tappable={false}
			// Distance labels sit above hazard labels when they collide.
			zIndex={small ? 1 : 2}
		>
			<View
				style={[styles.label, small && styles.labelSmall]}
				onLayout={() => requestAnimationFrame(() => setTracking(false))}
			>
				<Text style={[styles.labelText, small && styles.labelTextSmall]}>
					{text}
				</Text>
			</View>
		</Marker>
	);
}

const styles = StyleSheet.create({
	handle: {
		position: "absolute",
		width: HANDLE,
		height: HANDLE,
		borderRadius: HANDLE / 2,
	},
	loupe: {
		position: "absolute",
		width: LOUPE,
		height: LOUPE,
		borderRadius: LOUPE / 2,
		overflow: "hidden",
		borderWidth: 3,
		borderColor: course.target,
		backgroundColor: course.labelFill,
	},
	loupeMap: {
		position: "absolute",
		top: -LOUPE / 2,
		left: -LOUPE / 2,
		width: LOUPE * 2,
		height: LOUPE * 2,
	},
	// Kept mounted (tiles stay warm) but off-screen between drags.
	loupeHidden: { top: -1000, left: -1000, opacity: 0 },
	crossH: {
		position: "absolute",
		top: LOUPE / 2 - 1,
		left: LOUPE / 2 - 14,
		width: 28,
		height: 2,
		backgroundColor: course.target,
	},
	crossV: {
		position: "absolute",
		left: LOUPE / 2 - 1,
		top: LOUPE / 2 - 14,
		width: 2,
		height: 28,
		backgroundColor: course.target,
	},
	loupeDot: {
		position: "absolute",
		left: LOUPE / 2 - 3,
		top: LOUPE / 2 - 3,
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: course.distanceText,
	},
	pin: {
		width: 14,
		height: 14,
		borderRadius: 7,
		backgroundColor: course.flag,
		borderWidth: 2,
		borderColor: course.distanceText,
	},
	playerHalo: {
		width: 30,
		height: 30,
		borderRadius: 15,
		backgroundColor: course.playerHalo,
		alignItems: "center",
		justifyContent: "center",
	},
	player: {
		width: 14,
		height: 14,
		borderRadius: 7,
		backgroundColor: course.player,
		borderWidth: 2,
		borderColor: course.distanceText,
	},
	target: {
		width: 34,
		height: 34,
		borderRadius: 17,
		borderWidth: 3,
		borderColor: course.target,
		alignItems: "center",
		justifyContent: "center",
	},
	targetDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: course.target,
	},
	shot: {
		width: 18,
		height: 18,
		borderRadius: 9,
		backgroundColor: course.labelFill,
		borderWidth: 1.5,
		borderColor: course.shotLine,
		alignItems: "center",
		justifyContent: "center",
	},
	shotText: {
		...typeRamp.micro,
		color: course.distanceText,
		fontWeight: "800",
	},
	label: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 10,
		backgroundColor: course.labelFill,
	},
	labelSmall: { paddingHorizontal: 6, paddingVertical: 2 },
	labelText: {
		...typeRamp.control,
		color: course.distanceText,
		fontWeight: "800",
		fontVariant: ["tabular-nums"],
	},
	labelTextSmall: { ...typeRamp.caption, fontWeight: "700" },
});
