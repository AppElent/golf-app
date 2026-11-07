import { Pressable, StyleSheet, View } from "react-native";
import { useI18n } from "../../../i18n";
import { course, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HudGlass } from "../hud/hud-glass";
import { hudStyles } from "../hud/hud-styles";

/** Always on screen in simulation mode: nothing here is the real round. */
export function PlaySimulationBanner({
	top,
	onExit,
}: {
	top: number;
	onExit: () => void;
}) {
	const { t } = useI18n();
	return (
		<View style={[styles.banner, { top }]} pointerEvents="box-none">
			<Pressable
				testID="simulation-exit"
				accessibilityRole="button"
				accessibilityLabel={t.play.simulationExitLabel}
				onPress={onExit}
				hitSlop={6}
			>
				<HudGlass style={styles.pill}>
					<View style={styles.dot} />
					<AppText variant="caption" style={hudStyles.onHud}>
						{t.play.simulationBanner}
					</AppText>
					<AppText variant="caption" style={styles.exit}>
						{t.play.simulationExit}
					</AppText>
				</HudGlass>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	banner: { position: "absolute", left: 0, right: 0, alignItems: "center" },
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: course.flag,
	},
	exit: { color: course.target, fontWeight: "800" },
});
