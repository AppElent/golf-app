import { StyleSheet, View } from "react-native";
import { metrics, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HudGlass } from "../hud/hud-glass";
import { hudLayout } from "../hud/hud-layout";
import { hudStyles } from "../hud/hud-styles";

/** Where the game stands, under the top bar; announced when it changes. */
export function PlayGameCapsule({ top, text }: { top: number; text: string }) {
	return (
		<View style={[styles.place, { top }]} pointerEvents="none">
			<HudGlass style={styles.capsule}>
				<AppText
					variant="label"
					role="status"
					accessibilityLiveRegion="polite"
					numberOfLines={1}
					maxFontSizeMultiplier={1.2}
					style={hudStyles.onHud}
				>
					{text}
				</AppText>
			</HudGlass>
		</View>
	);
}

const styles = StyleSheet.create({
	place: {
		position: "absolute",
		left: metrics.screenGutter,
		right: metrics.screenGutter,
		alignItems: "center",
	},
	capsule: {
		minHeight: hudLayout.gameCapsule - spacing.sm,
		justifyContent: "center",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
	},
});
