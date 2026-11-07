import { holeLabel } from "@fairway/core/format";
import { nineRanges, type ScoreMark } from "@fairway/core/scoring";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	course,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../../theme";
import { AppText } from "../../../ui/text";
import type { CardHole, CardPlayerRow } from "./scorecard-model";

const CELL = 28;

export function ScorecardGrid({
	holes,
	players,
	rows,
	currentHole,
	onHolePress,
}: {
	holes: readonly CardHole[];
	players: readonly { name: string }[];
	rows: readonly CardPlayerRow[];
	currentHole?: number;
	onHolePress?: (holeIndex: number) => void;
}) {
	const { t } = useI18n();
	const styles = useThemedStyles(createStyles);
	const ranges = nineRanges(holes.length);
	const label = (i: number) => holeLabel(holes[i].ref);

	return (
		<View style={styles.blocks}>
			{ranges.map(({ from, to }, nine) => {
				const indices = Array.from({ length: to - from }, (_, i) => from + i);
				const parSum = indices.reduce((sum, i) => sum + holes[i].par, 0);
				const totalLabel =
					ranges.length === 1
						? t.scorecard.total
						: nine === 0
							? t.scorecard.out
							: t.scorecard.in;
				return (
					<ScrollView
						key={from}
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.card}
					>
						<View>
							<View style={[styles.row, styles.headRow]}>
								<NameCell text={t.scorecard.hole} strong />
								{indices.map((i) => (
									<Pressable
										key={i}
										disabled={!onHolePress}
										onPress={() => onHolePress?.(i)}
										accessibilityRole={onHolePress ? "button" : undefined}
										accessibilityLabel={fmt(t.scorecard.editHole, {
											n: label(i),
										})}
										style={[styles.cell, i === currentHole && styles.current]}
									>
										<AppText variant="label" style={styles.headText}>
											{label(i)}
										</AppText>
									</Pressable>
								))}
								<View style={[styles.cell, styles.sumCell]}>
									<AppText variant="label" style={styles.headText}>
										{totalLabel}
									</AppText>
								</View>
							</View>
							<View style={styles.row}>
								<NameCell text={t.scorecard.par} />
								{indices.map((i) => (
									<View key={i} style={styles.cell}>
										<AppText variant="footnote" style={styles.num}>
											{holes[i].par}
										</AppText>
									</View>
								))}
								<View style={[styles.cell, styles.sumCell]}>
									<AppText variant="footnote" style={styles.num}>
										{parSum}
									</AppText>
								</View>
							</View>
							{rows.map((row, p) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: players are fixed at round start
								<View key={p} style={styles.row}>
									<NameCell text={players[p]?.name ?? ""} strong />
									{indices.map((i) => (
										<Pressable
											key={i}
											disabled={!onHolePress}
											onPress={() => onHolePress?.(i)}
											accessibilityLabel={fmt(t.scorecard.editHole, {
												n: label(i),
											})}
											style={styles.cell}
										>
											<Marked
												mark={row.cells[i].mark}
												text={
													row.cells[i].nr
														? "–"
														: (row.cells[i].strokes?.toString() ?? "")
												}
											/>
										</Pressable>
									))}
									<View style={[styles.cell, styles.sumCell]}>
										<AppText style={[styles.num, styles.sum]}>
											{row.nines[nine] || ""}
										</AppText>
									</View>
								</View>
							))}
						</View>
					</ScrollView>
				);
			})}
		</View>
	);
}

function NameCell({ text, strong }: { text: string; strong?: boolean }) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.nameCell}>
			<AppText
				variant={strong ? "label" : "footnote"}
				numberOfLines={1}
				style={strong ? styles.headText : undefined}
			>
				{text}
			</AppText>
		</View>
	);
}

function Marked({ mark, text }: { mark: ScoreMark | null; text: string }) {
	const styles = useThemedStyles(createStyles);
	const shape =
		mark === "birdie"
			? styles.circle
			: mark === "eagle"
				? [styles.circle, styles.double]
				: mark === "bogey"
					? styles.box
					: mark === "double"
						? [styles.box, styles.double]
						: null;
	return (
		<View style={[styles.mark, shape]}>
			<AppText
				style={[
					styles.num,
					(mark === "birdie" || mark === "eagle") && styles.under,
				]}
			>
				{text}
			</AppText>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		blocks: { gap: spacing.md },
		card: {
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
			paddingVertical: spacing.xs,
			paddingHorizontal: spacing.sm,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			minHeight: CELL + 8,
		},
		headRow: {
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.separator,
		},
		nameCell: { width: 52, paddingRight: spacing.xs },
		cell: {
			width: CELL,
			height: CELL + 8,
			alignItems: "center",
			justifyContent: "center",
		},
		sumCell: { width: CELL + 10 },
		current: { backgroundColor: colors.accentDim, borderRadius: radius.sm },
		headText: { color: colors.text, fontWeight: "700" },
		num: { fontVariant: ["tabular-nums"], textAlign: "center" },
		sum: { fontWeight: "800" },
		under: { color: course.birdie, fontWeight: "700" },
		mark: {
			width: 26,
			height: 26,
			alignItems: "center",
			justifyContent: "center",
		},
		circle: {
			borderRadius: 13,
			borderWidth: 1.5,
			borderColor: course.birdie,
		},
		box: { borderWidth: 1.5, borderColor: colors.textMuted },
		double: { borderWidth: 3 },
	});
