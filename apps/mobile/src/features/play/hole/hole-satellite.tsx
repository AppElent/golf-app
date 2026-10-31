/**
 * Satellite hole view (Apple Maps on iOS, Google Maps on Android): imagery
 * rotated tee → green with the Golfshot overlays — yellow target line, a
 * draggable target, distance labels on each leg and hazard numbers. Tap the
 * map to move the target. Rotation and tilt are locked; pinch and pan are not.
 */
import { interpolate, type LatLng } from "@fairway/core/geo";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
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
	} = props;
	const map = useRef<MapView>(null);
	const [height, setHeight] = useState(0);
	const from = located ? player : tee;

	const camera = holeCamera({
		from,
		green,
		viewportHeight: height - insets.top - insets.bottom,
		greenView,
	});
	// Re-frame on hole change / view toggle, not on every GPS tick.
	const frameKey = `${green.lat},${green.lng},${greenView},${height > 0}`;
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

	return (
		<View
			style={StyleSheet.absoluteFill}
			onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
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
					onPress={(e) =>
						onTargetChange({
							lat: e.nativeEvent.coordinate.latitude,
							lng: e.nativeEvent.coordinate.longitude,
						})
					}
				>
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
						>
							<View style={styles.playerHalo}>
								<View style={styles.player} />
							</View>
						</Marker>
					) : null}
					<Label at={interpolate(from, target, 0.5)} text={toTargetLabel} />
					{targetToGreenLabel ? (
						<Label
							at={interpolate(target, green, 0.5)}
							text={targetToGreenLabel}
						/>
					) : null}
					{hazards.map((h) => (
						<Label
							key={`${h.at.lat},${h.at.lng}`}
							at={h.at}
							text={hazardLabel(h)}
							small
						/>
					))}
					<Marker
						coordinate={toCoord(target)}
						anchor={{ x: 0.5, y: 0.5 }}
						draggable
						tracksViewChanges={false}
						onDragEnd={(e) =>
							onTargetChange({
								lat: e.nativeEvent.coordinate.latitude,
								lng: e.nativeEvent.coordinate.longitude,
							})
						}
					>
						<View style={styles.target}>
							<View style={styles.targetDot} />
						</View>
					</Marker>
				</MapView>
			) : null}
		</View>
	);
}

/** A distance label floating over the imagery. Remounts when its text changes
 *  so the marker bitmap is redrawn (tracksViewChanges stays off for speed). */
function Label({
	at,
	text,
	small,
}: {
	at: LatLng;
	text: string;
	small?: boolean;
}) {
	return (
		<Marker
			key={text}
			coordinate={toCoord(at)}
			anchor={{ x: 0.5, y: 0.5 }}
			tracksViewChanges={false}
			tappable={false}
			// Distance labels sit above hazard labels when they collide.
			zIndex={small ? 1 : 2}
		>
			<View style={[styles.label, small && styles.labelSmall]}>
				<Text style={[styles.labelText, small && styles.labelTextSmall]}>
					{text}
				</Text>
			</View>
		</Marker>
	);
}

const styles = StyleSheet.create({
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
