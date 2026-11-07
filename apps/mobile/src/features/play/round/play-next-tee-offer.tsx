import { holeLabel } from "@fairway/core/format";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { course, metrics, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HudGlass } from "../hud/hud-glass";
import { hudStyles } from "../hud/hud-styles";

export function PlayNextTeeOffer({
	bottom,
	nextRef,
	onDismiss,
	onGo,
}: {
	bottom: number;
	nextRef: string;
	onDismiss: () => void;
	onGo: () => void;
}) {
	const { t } = useI18n();
	const n = holeLabel(nextRef);
	return (
		<View style={[hudStyles.tray, { bottom }]} pointerEvents="box-none">
			<HudGlass capsule={false} style={styles.offer}>
				<AppText
					variant="control"
					style={[hudStyles.onHud, styles.offerText]}
					accessibilityRole="alert"
				>
					{fmt(t.play.nextTee, { n })}
				</AppText>
				<Pressable
					accessibilityRole="button"
					onPress={onDismiss}
					hitSlop={6}
					style={({ pressed }) => [
						styles.offerButton,
						pressed && hudStyles.pressed,
					]}
				>
					<AppText variant="control" style={hudStyles.onHudMuted}>
						{t.play.notNow}
					</AppText>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					onPress={onGo}
					hitSlop={6}
					style={({ pressed }) => [
						styles.offerButton,
						styles.offerGo,
						pressed && hudStyles.pressed,
					]}
				>
					<AppText variant="control" style={styles.offerGoText}>
						{fmt(t.play.goToHole, { n })}
					</AppText>
				</Pressable>
			</HudGlass>
		</View>
	);
}

const styles = StyleSheet.create({
	offer: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		padding: spacing.xs,
		paddingLeft: spacing.md,
	},
	offerText: { flex: 1 },
	offerButton: {
		minHeight: metrics.hitTarget,
		paddingHorizontal: spacing.md,
		borderRadius: 22,
		alignItems: "center",
		justifyContent: "center",
	},
	offerGo: { backgroundColor: course.target },
	offerGoText: { color: course.onTarget, fontWeight: "800" },
});
