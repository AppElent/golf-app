import type { Club } from "@fairway/core/club-suggest";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useI18n } from "../../../i18n";
import { course, metrics, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HudGlass } from "../hud/hud-glass";
import { hudStyles } from "../hud/hud-styles";

export function PlayClubTray({
	bottom,
	bag,
	onPick,
}: {
	bottom: number;
	bag: ReadonlyArray<Club>;
	onPick: (club: string | undefined) => void;
}) {
	const { t } = useI18n();
	return (
		<View style={[hudStyles.tray, { bottom }]} pointerEvents="box-none">
			<HudGlass capsule={false} style={styles.trayCard}>
				<AppText
					variant="caption"
					style={[hudStyles.onHudMuted, styles.trayTitle]}
				>
					{t.play.whichClub}
				</AppText>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.clubRow}
				>
					{bag.map((club) => (
						<Pressable
							key={club.name}
							accessibilityRole="button"
							onPress={() => onPick(club.name)}
							style={({ pressed }) => [
								styles.clubChip,
								pressed && hudStyles.pressed,
							]}
						>
							<AppText variant="control" style={hudStyles.onHud}>
								{club.name}
							</AppText>
						</Pressable>
					))}
					<Pressable
						accessibilityRole="button"
						onPress={() => onPick(undefined)}
						style={({ pressed }) => [
							styles.clubChip,
							styles.skipChip,
							pressed && hudStyles.pressed,
						]}
					>
						<AppText variant="control" style={hudStyles.onHudMuted}>
							{t.play.skipClub}
						</AppText>
					</Pressable>
				</ScrollView>
			</HudGlass>
		</View>
	);
}

const styles = StyleSheet.create({
	trayCard: { paddingVertical: spacing.sm, gap: spacing.xs },
	trayTitle: { paddingHorizontal: spacing.md },
	clubRow: { gap: spacing.xs, paddingHorizontal: spacing.md },
	clubChip: {
		minHeight: metrics.hitTarget,
		minWidth: 52,
		paddingHorizontal: spacing.md,
		borderRadius: 22,
		borderWidth: 1,
		borderColor: course.ring,
		alignItems: "center",
		justifyContent: "center",
	},
	skipChip: { borderStyle: "dashed" },
});
