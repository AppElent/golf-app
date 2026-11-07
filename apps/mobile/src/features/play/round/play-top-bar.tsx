import { distanceValue, type Units } from "@fairway/core/format";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { course, spacing, type as typeRamp } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HudButton } from "../hud/hud-button";
import { HudGlass } from "../hud/hud-glass";
import { hudLayout } from "../hud/hud-layout";
import { hudStyles } from "../hud/hud-styles";

export function PlayTopBar({
	top,
	title,
	meta,
	holeIndex,
	holeCount,
	units,
	onGoTo,
}: {
	top: number;
	title: string;
	meta: { par: number; strokeIndex: number; lengthMeters?: number } | undefined;
	holeIndex: number;
	holeCount: number;
	units: Units;
	onGoTo: (holeIndex: number) => void;
}) {
	const { t } = useI18n();
	const router = useRouter();
	const isLast = holeIndex >= holeCount - 1;
	return (
		<View style={[styles.topBar, { top }]} pointerEvents="box-none">
			<HudButton
				symbol={{ ios: "xmark", android: "close" }}
				label={t.play.close}
				onPress={() => router.back()}
			/>
			<HudGlass style={styles.switcher}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t.play.previousHole}
					disabled={holeIndex === 0}
					onPress={() => onGoTo(holeIndex - 1)}
					hitSlop={8}
					style={[styles.chevron, holeIndex === 0 && styles.disabled]}
				>
					<AppText style={styles.chevronGlyph}>‹</AppText>
				</Pressable>
				<View style={styles.switcherText} accessibilityRole="header">
					<AppText variant="heading" style={hudStyles.onHud}>
						{title}
					</AppText>
					<AppText variant="caption" style={hudStyles.onHudMuted}>
						{fmt(t.play.holeMeta, {
							par: meta?.par ?? "—",
							si: meta?.strokeIndex ?? "—",
						})}
						{meta?.lengthMeters
							? ` · ${distanceValue(meta.lengthMeters, units)} ${units}`
							: ""}
					</AppText>
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t.play.nextHole}
					disabled={isLast}
					onPress={() => onGoTo(holeIndex + 1)}
					hitSlop={8}
					style={[styles.chevron, isLast && styles.disabled]}
				>
					<AppText style={styles.chevronGlyph}>›</AppText>
				</Pressable>
			</HudGlass>
			<HudButton
				symbol={{ ios: "list.number", android: "format_list_numbered" }}
				label={t.play.scorecard}
				onPress={() => router.push("/scorecard")}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	topBar: {
		position: "absolute",
		left: spacing.md,
		right: spacing.md,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	switcher: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: spacing.xs,
		minHeight: hudLayout.barMinHeight,
	},
	switcherText: { flex: 1, alignItems: "center" },
	chevron: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
	chevronGlyph: { ...typeRamp.title, color: course.hudText },
	disabled: { opacity: 0.3 },
});
