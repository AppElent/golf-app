import type { RefObject } from "react";
import { StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import { course } from "../../../theme";
import type { Point } from "./use-target-drag";

const LOUPE = 136;
/** How far above the finger the loupe floats, centre to centre. */
const LOUPE_LIFT = 110;

/** Magnifies the spot the finger covers while dragging the target. */
export function HoleLoupe({
	mapRef,
	finger,
	width,
}: {
	mapRef: RefObject<MapView | null>;
	finger: Point | null;
	width: number;
}) {
	return (
		<View
			pointerEvents="none"
			style={[
				styles.loupe,
				finger ? loupePosition(finger, width) : styles.loupeHidden,
			]}
		>
			<MapView
				ref={mapRef}
				// Twice the circle, so the map's logo and legal link fall outside
				// the clip.
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
	);
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

const styles = StyleSheet.create({
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
});
