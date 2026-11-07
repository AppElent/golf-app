import { distanceValue, type Units } from "@fairway/core/format";
import type { LatLng } from "@fairway/core/geo";
import { greenNumbers, type HoleAnchors } from "@fairway/core/hole-view";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../../i18n";
import { course, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HudGlass } from "../hud/hud-glass";
import { hudStyles, hudTextShadow } from "../hud/hud-styles";

export function PlayDistances({
	top,
	anchors,
	player,
	units,
}: {
	top: number;
	anchors: HoleAnchors | null;
	player: LatLng | null;
	units: Units;
}) {
	const { t } = useI18n();
	if (!anchors || !player) return null;
	const numbers = greenNumbers(player, anchors);
	return (
		<View
			style={[styles.stackWrap, { top }]}
			pointerEvents="none"
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
	stackWrap: { position: "absolute", right: spacing.md },
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
