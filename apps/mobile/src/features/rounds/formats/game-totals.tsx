import { StyleSheet, View } from "react-native";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";
import type { GameResult } from "./game-text";

type Totals = NonNullable<GameResult["list"]>;

/** Skins or points per player. */
export function GameTotals(totals: Totals) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.card}>
			<TotalRows {...totals} />
		</View>
	);
}

/** How the game of a round ended. */
export function GameResultCard({ kicker, title, sub, list }: GameResult) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.card}>
			<View accessible style={styles.result}>
				<AppText variant="footnote">{kicker}</AppText>
				<AppText variant="title">{title}</AppText>
				{sub ? <AppText variant="secondary">{sub}</AppText> : null}
			</View>
			{list ? <TotalRows {...list} /> : null}
		</View>
	);
}

function TotalRows({ title, rows }: Totals) {
	const styles = useThemedStyles(createStyles);
	return (
		<>
			<AppText variant="label" accessibilityRole="header">
				{title}
			</AppText>
			{rows.map(({ label, value }, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: two guests can share a name
				<View key={i} accessible style={styles.row}>
					<AppText variant="secondary" style={styles.name}>
						{label}
					</AppText>
					<AppText style={styles.value}>{value}</AppText>
				</View>
			))}
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		card: {
			gap: spacing.sm,
			padding: spacing.md,
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
		},
		result: { gap: spacing.xs },
		row: {
			flexDirection: "row",
			justifyContent: "space-between",
			gap: spacing.md,
		},
		name: { flexShrink: 1 },
		value: { fontVariant: ["tabular-nums"] },
	});
