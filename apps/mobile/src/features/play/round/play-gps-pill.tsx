import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HudGlass } from "../hud/hud-glass";
import { hudStyles } from "../hud/hud-styles";
import type { GpsNotice } from "./play-model";

export function PlayGpsPill({
	top,
	notice,
}: {
	top: number;
	notice: GpsNotice | null;
}) {
	const { t } = useI18n();
	if (!notice) return null;
	const message =
		notice.kind === "weak"
			? fmt(t.play.gpsWeak, { m: notice.meters })
			: t.play[notice.kind];
	return (
		<View style={[styles.gpsNote, { top }]} pointerEvents="none">
			<HudGlass style={styles.gpsPill}>
				<AppText variant="caption" style={hudStyles.onHudMuted}>
					{message}
				</AppText>
			</HudGlass>
		</View>
	);
}

const styles = StyleSheet.create({
	gpsNote: { position: "absolute", left: 0, right: 0, alignItems: "center" },
	gpsPill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
