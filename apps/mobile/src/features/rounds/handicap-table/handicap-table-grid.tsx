import type { HandicapTableRow } from "@fairway/core/handicap-table";
import { StyleSheet, View } from "react-native";
import { fmt, plural, useI18n } from "../../../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";

/** "●" per stroke received, "−1" for a stroke given back, nothing for none. */
function strokesMark(strokes: number): string {
	return strokes < 0 ? `−${-strokes}` : "●".repeat(strokes);
}

/** A playing handicap as golfers write it: "14", "+2" for a plus handicap. */
function handicapText(value: number | undefined): string {
	if (value === undefined) return "–";
	return value < 0 ? `+${-value}` : String(value);
}

export function HandicapTableGrid({
	rows,
	players,
	currentHole,
}: {
	rows: readonly HandicapTableRow[];
	players: readonly { name: string; playingHandicap?: number }[];
	/** Index of the hole being played; none while setting up a round. */
	currentHole?: number;
}) {
	const { t, locale } = useI18n();
	const styles = useThemedStyles(createStyles);

	function strokesLabel(name: string, strokes: number): string {
		const forms =
			strokes < 0 ? t.handicapTable.givesBack : t.handicapTable.strokes;
		return `${name}: ${plural(locale, Math.abs(strokes), forms)}`;
	}

	return (
		<View style={styles.table}>
			<View style={[styles.row, styles.head]}>
				<AppText variant="caption" style={[styles.hole, styles.strong]}>
					{t.scorecard.hole}
				</AppText>
				<AppText variant="caption" style={[styles.number, styles.strong]}>
					{t.scorecard.par}
				</AppText>
				<AppText variant="caption" style={[styles.number, styles.strong]}>
					{t.handicapTable.strokeIndex}
				</AppText>
				{players.map((player, p) => (
					<View
						// biome-ignore lint/suspicious/noArrayIndexKey: players have no id; the index is their identity
						key={p}
						accessible
						accessibilityLabel={
							player.playingHandicap === undefined
								? player.name
								: `${player.name}, ${fmt(t.setup.plays, {
										value: handicapText(player.playingHandicap),
									})}`
						}
						style={styles.player}
					>
						<AppText variant="caption" numberOfLines={1} style={styles.strong}>
							{player.name}
						</AppText>
						<AppText variant="caption" style={styles.tabular}>
							{handicapText(player.playingHandicap)}
						</AppText>
					</View>
				))}
			</View>
			{rows.map((row, i) => {
				const current = i === currentHole;
				const strong = current && styles.strong;
				return (
					<View
						// biome-ignore lint/suspicious/noArrayIndexKey: a loop played twice repeats its holes
						key={i}
						style={[styles.row, styles.divided, current && styles.current]}
					>
						<AppText
							variant="label"
							accessibilityLabel={`${t.scorecard.hole} ${row.hole}`}
							accessibilityState={{ selected: current }}
							style={[styles.hole, styles.ink, strong]}
						>
							{row.hole}
						</AppText>
						<AppText
							variant="footnote"
							accessibilityLabel={`${t.scorecard.par} ${row.par}`}
							style={[styles.number, styles.ink, strong]}
						>
							{row.par}
						</AppText>
						<AppText
							variant="footnote"
							accessibilityLabel={`${t.handicapTable.strokeIndex} ${row.strokeIndex}`}
							style={[styles.number, strong]}
						>
							{row.strokeIndex}
						</AppText>
						{players.map((player, p) => (
							<View
								// biome-ignore lint/suspicious/noArrayIndexKey: players have no id; the index is their identity
								key={p}
								accessible
								accessibilityLabel={strokesLabel(player.name, row.strokes[p])}
								style={styles.player}
							>
								<AppText variant="caption" style={[styles.mark, strong]}>
									{strokesMark(row.strokes[p])}
								</AppText>
							</View>
						))}
					</View>
				);
			})}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		table: {
			backgroundColor: colors.surface,
			borderRadius: radius.card,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		// 18 rows fit one sheet; nothing here is tappable. Grows with text size.
		row: {
			minHeight: 30,
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: spacing.sm,
		},
		head: { paddingVertical: spacing.sm },
		divided: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		current: { backgroundColor: colors.accentDim },
		hole: { flex: 1, paddingLeft: spacing.xs },
		number: { flex: 1, textAlign: "center", fontVariant: ["tabular-nums"] },
		player: {
			flex: 1.5,
			alignItems: "center",
			alignSelf: "stretch",
			justifyContent: "center",
		},
		ink: { color: colors.text },
		strong: { fontWeight: "700" },
		tabular: { fontVariant: ["tabular-nums"] },
		mark: { color: colors.accent, letterSpacing: 1 },
	});
