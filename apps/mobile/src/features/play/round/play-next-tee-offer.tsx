import { holeLabel } from "@fairway/core/format";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { course, metrics, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HudGlass } from "../hud/hud-glass";
import { hudStyles } from "../hud/hud-styles";

/**
 * On the next tee: move on, or first score the hole being left when it has
 * no score yet (`unscoredRef`).
 */
export function PlayNextTeeOffer({
	bottom,
	nextRef,
	unscoredRef,
	onDismiss,
	onGo,
	onScore,
}: {
	bottom: number;
	nextRef: string;
	unscoredRef: string | null;
	onDismiss: () => void;
	onGo: () => void;
	onScore: () => void;
}) {
	const { t } = useI18n();
	const n = holeLabel(nextRef);
	const actionLabel = unscoredRef
		? fmt(t.play.scoreBeforeNext, { n: holeLabel(unscoredRef) })
		: fmt(t.play.goToHole, { n });
	return (
		<View style={[hudStyles.tray, { bottom }]} pointerEvents="box-none">
			<HudGlass capsule={false} style={styles.offer}>
				<AppText
					variant="control"
					style={hudStyles.onHud}
					accessibilityRole="alert"
				>
					{fmt(t.play.nextTee, { n })}
				</AppText>
				<View style={styles.actions}>
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
						onPress={unscoredRef ? onScore : onGo}
						hitSlop={6}
						style={({ pressed }) => [
							styles.offerButton,
							styles.offerGo,
							pressed && hudStyles.pressed,
						]}
					>
						<AppText variant="control" style={styles.offerGoText}>
							{actionLabel}
						</AppText>
					</Pressable>
				</View>
			</HudGlass>
		</View>
	);
}

const styles = StyleSheet.create({
	// Message above, actions below: the "Score hole N" labels (Dutch most of
	// all) leave no room for the message beside them on a phone.
	offer: {
		gap: spacing.xs,
		padding: spacing.xs,
		paddingLeft: spacing.md,
		paddingTop: spacing.sm,
	},
	actions: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "flex-end",
		gap: spacing.xs,
	},
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
