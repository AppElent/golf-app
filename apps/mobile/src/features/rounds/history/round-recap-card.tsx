import { holeLabel } from "@fairway/core/format";
import type { RoundRecap } from "@fairway/core/recap";
import { markForToPar, SCORE_MARKS } from "@fairway/core/scoring";
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";

export function RoundRecapCard({
	recap,
	holes,
	nineLabels,
	vsPar,
}: {
	recap: RoundRecap;
	holes: readonly { ref: string }[];
	nineLabels: readonly string[];
	vsPar: (n: number) => string;
}) {
	const { t } = useI18n();
	const styles = useThemedStyles(createStyles);
	const resultName = (toPar: number) => {
		const mark = markForToPar(toPar);
		return mark === "eagle" || mark === "birdie" || mark === "par"
			? t.rounds[mark]
			: vsPar(toPar);
	};
	const holeResult = (h: { holeIndex: number; toPar: number }) =>
		fmt(t.rounds.holeResult, {
			result: resultName(h.toPar),
			hole: holeLabel(holes[h.holeIndex].ref),
		});

	return (
		<View style={styles.recap}>
			<AppText variant="label">{t.rounds.recap}</AppText>
			<View style={styles.marks}>
				{SCORE_MARKS.map((m) => (
					<View key={m} style={styles.mark}>
						<AppText variant="title" style={styles.value}>
							{recap.marks[m]}
						</AppText>
						<AppText variant="footnote">{t.rounds.markShort[m]}</AppText>
					</View>
				))}
			</View>
			{recap.best ? (
				<RecapLine label={t.rounds.bestHole} value={holeResult(recap.best)} />
			) : null}
			{recap.toughest ? (
				<RecapLine
					label={t.rounds.toughestHole}
					value={holeResult(recap.toughest)}
				/>
			) : null}
			{recap.nines.length > 1
				? recap.nines.map((n, i) => (
						<RecapLine
							key={nineLabels[i]}
							label={nineLabels[i]}
							value={`${n.strokes} (${vsPar(n.toPar)})`}
						/>
					))
				: null}
		</View>
	);
}

function RecapLine({ label, value }: { label: string; value: string }) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.recapLine}>
			<AppText variant="secondary">{label}</AppText>
			<AppText style={styles.value}>{value}</AppText>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		recap: {
			gap: spacing.sm,
			padding: spacing.md,
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
		},
		marks: { flexDirection: "row", justifyContent: "space-between" },
		mark: { alignItems: "center", flex: 1, gap: 2 },
		value: { fontVariant: ["tabular-nums"] },
		recapLine: {
			flexDirection: "row",
			justifyContent: "space-between",
			gap: spacing.md,
		},
	});
