/**
 * Ported from the web's `src/components/OfflineBanner.tsx`.
 *
 * Convex queues mutations while the socket is down and replays them on
 * reconnect, so the app stays usable offline — but a set that hasn't reached
 * the server yet looks identical to one that has. This banner is the only thing
 * telling the difference, which matters most in exactly the place a phone loses
 * signal: a basement gym.
 *
 * No dismiss button, deliberately. It disappears when the condition does.
 * It also waits out the same grace period as the screens: every cold start
 * begins disconnected, and flashing the banner there shifted the whole layout.
 *
 * The sentence comes from the message tree: this banner floats over every
 * screen including the Nutrition ones, and an English strip across a Dutch app
 * is exactly the kind of gap #79 exists to close.
 */
import { useConvexConnectionState } from "convex/react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStalledOffline } from "../data/stalled-offline";
import { useI18n } from "../i18n";
import { spacing, type Tokens, useThemedStyles } from "../theme";
import { AppText } from "./text";

export function OfflineBanner() {
	const styles = useThemedStyles(createStyles);
	const { isWebSocketConnected } = useConvexConnectionState();
	const insets = useSafeAreaInsets();
	const { t } = useI18n();
	const offline = useStalledOffline(true, isWebSocketConnected);

	if (!offline) return null;

	return (
		<View
			style={[styles.wrap, { paddingTop: insets.top + spacing.xs }]}
			pointerEvents="none"
		>
			<AppText variant="caption" style={styles.text}>
				{t.common.offline}
			</AppText>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		wrap: {
			alignItems: "center",
			paddingBottom: spacing.xs,
			paddingHorizontal: spacing.md,
			backgroundColor: colors.warnSoft,
			borderBottomWidth: 1,
			borderBottomColor: colors.warnBorder,
		},
		text: { color: colors.warn, fontWeight: "600" },
	});
