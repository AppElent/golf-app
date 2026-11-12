import type { Club } from "@fairway/core/club-suggest";
import type { Units } from "@fairway/core/format";
import { haversineMeters, type LatLng } from "@fairway/core/geo";
import {
	type HazardInPlay,
	type HoleAnchors,
	type HoleGeometry,
	hazardsInPlay,
} from "@fairway/core/hole-view";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HoleCanvas } from "../hole/hole-canvas";
import { hudLayout } from "../hud/hud-layout";
import { hudStyles } from "../hud/hud-styles";
import { hazardLabel, legLabel } from "./play-model";

export function PlayHoleView({
	anchors,
	geometry,
	player,
	located,
	target,
	onTargetChange,
	greenView,
	shots,
	bag,
	units,
	hudTop,
	hudBottom,
}: {
	anchors: HoleAnchors | null;
	geometry: HoleGeometry | null;
	player: LatLng | null;
	located: boolean;
	target: LatLng | null;
	onTargetChange: (target: LatLng) => void;
	greenView: boolean;
	shots: readonly LatLng[];
	bag: ReadonlyArray<Club>;
	units: Units;
	hudTop: number;
	hudBottom: number;
}) {
	const { t } = useI18n();
	if (!anchors || !player || !target || !geometry) {
		return (
			<View style={[styles.noMap, { paddingTop: hudTop + hudLayout.noMapTop }]}>
				<AppText variant="heading" style={hudStyles.onHud}>
					{t.play.noMap}
				</AppText>
				<AppText variant="footnote" style={hudStyles.onHudMuted}>
					{t.play.noMapHint}
				</AppText>
			</View>
		);
	}
	const toGreen = haversineMeters(target, anchors.green);
	return (
		<>
			<HoleCanvas
				geometry={geometry}
				green={anchors.green}
				player={player}
				located={located}
				target={target}
				onTargetChange={onTargetChange}
				toTargetLabel={legLabel(
					haversineMeters(player, target),
					units,
					bag,
					true,
				)}
				targetToGreenLabel={
					toGreen < 8 ? null : legLabel(toGreen, units, bag, false)
				}
				// The green view is about the green itself; hazard callouts are
				// tee-shot info.
				hazards={
					greenView
						? []
						: hazardsInPlay(player, anchors.green, geometry, { limit: 3 })
				}
				hazardLabel={(h: HazardInPlay) => hazardLabel(h, units)}
				greenView={greenView}
				shots={shots}
				insets={{
					top: hudTop + hudLayout.canvasTop,
					bottom: hudBottom + hudLayout.canvasBottom,
					left: 0,
					right: hudLayout.canvasRight,
				}}
			/>
			<AppText
				variant="caption"
				pointerEvents="none"
				style={[
					hudStyles.onHud,
					styles.credit,
					{ bottom: hudBottom + hudLayout.canvasBottom },
				]}
			>
				{t.play.osmCredit}
			</AppText>
		</>
	);
}

const styles = StyleSheet.create({
	// The hole layouts come from OpenStreetMap; its licence requires this
	// credit. It sits level with the map's own legal link, on the other side.
	credit: { position: "absolute", right: spacing.md, opacity: 0.85 },
	noMap: {
		flex: 1,
		alignItems: "center",
		gap: spacing.xs,
		padding: spacing.lg,
	},
});
