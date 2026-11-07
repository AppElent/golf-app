/**
 * Mutations a client sends while the socket is down wait for the reconnect, so a
 * score that has not reached the server looks like one that has. This banner
 * tells them apart. No dismiss button: it goes when the condition does.
 */
import { useConvexConnectionState } from "convex/react";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { spacing, type Tokens, useThemedStyles } from "../theme";
import { AppText } from "../ui/text";

/**
 * Convex's socket is disconnected for the first moments of every cold start, so
 * the banner waits out a normal handshake instead of flashing on launch.
 */
const OFFLINE_GRACE_MS = 2000;

function useStalledOffline(): boolean {
	const { isWebSocketConnected } = useConvexConnectionState();
	const [stalled, setStalled] = useState(false);

	useEffect(() => {
		if (isWebSocketConnected) {
			setStalled(false);
			return;
		}
		const timer = setTimeout(() => setStalled(true), OFFLINE_GRACE_MS);
		return () => clearTimeout(timer);
	}, [isWebSocketConnected]);

	return stalled;
}

export function OfflineBanner() {
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const { t } = useI18n();

	if (!useStalledOffline()) return null;

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
