import type { LatLng } from "@fairway/core/geo";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker, Polyline } from "react-native-maps";
import { course, type as typeRamp } from "../../../theme";
import { toCoord } from "./hole-camera";
import type { HoleCanvasProps } from "./hole-canvas-props";
import { holeOverlays } from "./hole-overlays";

export function HoleSatelliteOverlays({
	player,
	green,
	located,
	target,
	toTargetLabel,
	targetToGreenLabel,
	hazards,
	hazardLabel,
	shots,
}: Pick<
	HoleCanvasProps,
	| "player"
	| "green"
	| "located"
	| "target"
	| "toTargetLabel"
	| "targetToGreenLabel"
	| "hazards"
	| "hazardLabel"
	| "shots"
>) {
	const { trail, toTargetSpot, toGreenSpot } = holeOverlays({
		shots,
		player,
		located,
		hazards,
		target,
		green,
	});
	return (
		<>
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
				coordinates={[player, target, green].map(toCoord)}
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
					zIndex={3}
				>
					<View style={styles.playerHalo}>
						<View style={styles.player} />
					</View>
				</Marker>
			) : null}
			<Label
				key={`to-${toTargetLabel}`}
				at={toTargetSpot}
				text={toTargetLabel}
			/>
			{targetToGreenLabel ? (
				<Label
					key={`rest-${targetToGreenLabel}`}
					at={toGreenSpot}
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
		</>
	);
}

/** Remounts when its text changes (the `key` at each call site), tracks view
 *  changes until its auto-sized pill has laid out — snapshotted earlier it
 *  draws at zero size — then stops for speed. */
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
