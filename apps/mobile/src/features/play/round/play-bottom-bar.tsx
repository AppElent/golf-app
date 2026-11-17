import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { course, radius, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HudButton } from "../hud/hud-button";
import { hudLayout } from "../hud/hud-layout";

export function PlayBottomBar({
	bottom,
	holeIndex,
	holeNumber,
	hasAnchors,
	greenView,
	onToggleGreenView,
	marking,
	onMarkShot,
	offline = false,
}: {
	bottom: number;
	holeIndex: number;
	holeNumber: string | number;
	hasAnchors: boolean;
	greenView: boolean;
	onToggleGreenView: () => void;
	marking: boolean;
	onMarkShot: () => void;
	/** Display only: scoring and marking wait for a connection. */
	offline?: boolean;
}) {
	const { t } = useI18n();
	const router = useRouter();
	const scoreLabel = fmt(t.play.scoreHole, { n: holeNumber });
	return (
		<View style={[styles.bottomBar, { bottom }]} pointerEvents="box-none">
			<HudButton
				symbol={
					greenView
						? { ios: "map", android: "map" }
						: { ios: "flag.fill", android: "flag" }
				}
				label={greenView ? t.play.holeView : t.play.greenView}
				active={greenView}
				onPress={onToggleGreenView}
				disabled={!hasAnchors}
			/>
			{offline ? (
				<View style={[styles.scoreButton, styles.offlineScore]}>
					<AppText variant="control" style={styles.offlineLabel}>
						{t.play.offlineScoring}
					</AppText>
				</View>
			) : (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={scoreLabel}
					onPress={() =>
						router.push({
							pathname: "/score",
							params: { hole: String(holeIndex) },
						})
					}
					style={({ pressed }) => [
						styles.scoreButton,
						pressed && { opacity: 0.85 },
					]}
				>
					<AppText variant="control" style={styles.scoreLabel}>
						{scoreLabel}
					</AppText>
				</Pressable>
			)}
			{offline ? null : (
				<HudButton
					symbol={{ ios: "mappin.and.ellipse", android: "add_location" }}
					label={t.play.markShot}
					onPress={onMarkShot}
					disabled={!hasAnchors || marking}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	bottomBar: {
		position: "absolute",
		left: spacing.md,
		right: spacing.md,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	scoreButton: {
		flex: 1,
		minHeight: hudLayout.barMinHeight,
		borderRadius: radius.pill,
		backgroundColor: course.target,
		alignItems: "center",
		justifyContent: "center",
	},
	scoreLabel: { color: course.onTarget, fontWeight: "800" },
	offlineScore: { backgroundColor: course.hudFill },
	offlineLabel: { color: course.hudTextMuted, fontWeight: "600" },
});
