// Apple Maps on iOS, Google Maps on Android.
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import MapView from "react-native-maps";
import type { HoleCanvasProps } from "./hole-canvas-props";
import { HoleLoupe } from "./hole-loupe";
import { HoleSatelliteOverlays } from "./hole-satellite-overlays";
import { useHoleMapCamera } from "./use-hole-map-camera";
import { useTargetDrag } from "./use-target-drag";

/** The drag handle: a touch target over the target ring. */
const HANDLE = 64;

export function HoleSatellite(props: HoleCanvasProps) {
	const {
		green,
		player,
		located,
		target,
		onTargetChange,
		toTargetLabel,
		greenView,
		insets,
	} = props;
	const map = useRef<MapView>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const height = size.height;
	const camera = useHoleMapCamera({
		map,
		player,
		green,
		located,
		greenView,
		insets,
		height,
	});
	const { loupeMap, targetPoint, finger, pan, placeHandle, onRegionChange } =
		useTargetDrag({ map, target, height, onTargetChange });

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
					initialCamera={camera}
					mapPadding={insets}
					rotateEnabled={false}
					pitchEnabled={false}
					showsCompass={false}
					showsPointsOfInterests={false}
					showsBuildings={false}
					toolbarEnabled={false}
					moveOnMarkerPress={false}
					onRegionChange={onRegionChange}
					onRegionChangeComplete={placeHandle}
					onPress={(e) =>
						onTargetChange({
							lat: e.nativeEvent.coordinate.latitude,
							lng: e.nativeEvent.coordinate.longitude,
						})
					}
				>
					<HoleSatelliteOverlays {...props} />
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
				<HoleLoupe mapRef={loupeMap} finger={finger} width={size.width} />
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	handle: {
		position: "absolute",
		width: HANDLE,
		height: HANDLE,
		borderRadius: HANDLE / 2,
	},
});
