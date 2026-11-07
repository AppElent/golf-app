import { distanceValue, type Units } from "@fairway/core/format";
import type { LatLng } from "@fairway/core/geo";
import {
	greenNumbers,
	type HazardInPlay,
	type HoleAnchors,
	type HoleGeometry,
	hazardsInPlay,
} from "@fairway/core/hole-view";
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { course, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HudGlass } from "../hud/hud-glass";
import { hudStyles, hudTextShadow } from "../hud/hud-styles";

/** How far ahead the list reaches: all of a hole, from any tee. */
const HAZARDS_MAX_METERS = 650;
/** What fits over the map: the nearest ones, the rest come up as you play. */
const HAZARDS_LISTED = 5;

/** Which way to look: the same in every language. */
const SIDE_ARROW: Record<HazardInPlay["side"], string> = {
	left: "←",
	right: "→",
	center: "↑",
};

export function PlayDistances({
	top,
	anchors,
	player,
	geometry,
	units,
}: {
	top: number;
	anchors: HoleAnchors | null;
	player: LatLng | null;
	/** The hole to list hazards for; null hides the list (green view). */
	geometry: HoleGeometry | null;
	units: Units;
}) {
	const { t } = useI18n();
	if (!anchors || !player) return null;
	const numbers = greenNumbers(player, anchors);
	const hazards = geometry
		? hazardsInPlay(player, anchors.green, geometry, {
				maxMeters: HAZARDS_MAX_METERS,
				limit: HAZARDS_LISTED,
			})
		: [];
	return (
		<View style={[styles.stackWrap, { top }]} pointerEvents="none">
			<View
				accessible
				accessibilityLabel={`${t.play.front} ${distanceValue(numbers.front, units)}, ${t.play.center} ${distanceValue(numbers.center, units)}, ${t.play.back} ${distanceValue(numbers.back, units)} ${units}`}
			>
				<HudGlass capsule={false} style={styles.stack}>
					<Distance
						label={t.play.back}
						value={distanceValue(numbers.back, units)}
					/>
					<Distance
						label={t.play.center}
						value={distanceValue(numbers.center, units)}
						big
					/>
					<Distance
						label={t.play.front}
						value={distanceValue(numbers.front, units)}
					/>
					<AppText variant="micro" style={styles.unit}>
						{units}
					</AppText>
				</HudGlass>
			</View>
			{hazards.length > 0 ? (
				<HudGlass capsule={false} style={styles.hazards}>
					<AppText variant="micro" style={hudStyles.onHudMuted}>
						{t.play.hazards.toUpperCase()}
					</AppText>
					{hazards.map((hazard) => (
						<HazardRow
							key={`${hazard.kind}${hazard.at.lat},${hazard.at.lng}`}
							hazard={hazard}
							units={units}
						/>
					))}
				</HudGlass>
			) : null}
		</View>
	);
}

function HazardRow({ hazard, units }: { hazard: HazardInPlay; units: Units }) {
	const { t } = useI18n();
	const reach = distanceValue(hazard.reach, units);
	const carry = distanceValue(hazard.carry, units);
	const kind = hazard.kind === "water" ? t.play.water : t.play.bunker;
	const side = {
		left: t.play.sideLeft,
		right: t.play.sideRight,
		center: t.play.sideCenter,
	}[hazard.side];
	return (
		<View
			testID={`hazard-${hazard.kind}`}
			style={styles.hazard}
			accessible
			accessibilityLabel={fmt(t.play.hazardRow, {
				kind,
				side,
				reach,
				carry,
				units,
			})}
		>
			<View
				style={[
					styles.hazardDot,
					{
						backgroundColor:
							hazard.kind === "water" ? course.water : course.bunker,
					},
				]}
			/>
			<AppText variant="caption" style={styles.hazardText}>
				{SIDE_ARROW[hazard.side]} {reach}/{carry}
			</AppText>
		</View>
	);
}

function Distance({
	label,
	value,
	big,
}: {
	label: string;
	value: string;
	big?: boolean;
}) {
	return (
		<View style={styles.number}>
			<AppText variant="micro" style={hudStyles.onHudMuted}>
				{label.toUpperCase()}
			</AppText>
			<AppText
				variant={big ? "metric" : "heading"}
				style={[styles.numberValue, big && styles.numberBig]}
			>
				{value}
			</AppText>
		</View>
	);
}

const styles = StyleSheet.create({
	stackWrap: {
		position: "absolute",
		right: spacing.md,
		alignItems: "flex-end",
		gap: spacing.xs,
	},
	hazards: {
		paddingVertical: spacing.xs,
		paddingHorizontal: spacing.sm,
		gap: 2,
	},
	hazard: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
	hazardDot: { width: 8, height: 8, borderRadius: 4 },
	hazardText: {
		color: course.hudText,
		fontVariant: ["tabular-nums"],
		fontWeight: "700",
	},
	stack: {
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		alignItems: "center",
		gap: spacing.xs,
	},
	number: { alignItems: "center" },
	numberValue: {
		color: course.hudText,
		fontVariant: ["tabular-nums"],
		...hudTextShadow,
	},
	numberBig: { color: course.distanceText },
	unit: { color: course.hudTextMuted },
});
