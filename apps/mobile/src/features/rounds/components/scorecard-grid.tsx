import { holeLabel } from "@fairway/core/format";
import { nineRanges, type ScoreMark } from "@fairway/core/scoring";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { fmt, plural, useI18n } from "../../../i18n";
import {
	course,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../../theme";
import { AppText } from "../../../ui/text";
import type { GameCell, GameRow } from "../formats/game-text";
import type { CardHole, CardPlayerRow } from "./scorecard-model";

const CELL = 28;

export function ScorecardGrid({
	holes,
	players,
	rows,
	received,
	gameRows = [],
	currentHole,
	onHolePress,
}: {
	holes: readonly CardHole[];
	players: readonly { name: string }[];
	rows: readonly CardPlayerRow[];
	/** Strokes per side and hole, drawn as dots; left out when they don't matter. */
	received?: readonly (readonly number[])[];
	/** What the holes did in the game, under the players. */
	gameRows?: readonly GameRow[];
	currentHole?: number;
	onHolePress?: (holeIndex: number) => void;
}) {
	const { t, locale } = useI18n();
	const styles = useThemedStyles(createStyles);
	const ranges = nineRanges(holes.length);
	const label = (i: number) => holeLabel(holes[i].ref);
	// A read-only card (a finished round) has nothing to edit.
	const editLabel = (i: number) =>
		onHolePress ? fmt(t.scorecard.editHole, { n: label(i) }) : undefined;

	const strokesHint = (p: number, i: number) => {
		const count = received?.[p]?.[i] ?? 0;
		return count > 0
			? fmt(plural(locale, count, t.formats.getsStroke), {
					name: players[p]?.name ?? "",
				})
			: undefined;
	};

	const cellText = ({
		nr,
		missing,
		strokes,
	}: CardPlayerRow["cells"][number]) =>
		nr ? "–" : missing ? "?" : (strokes?.toString() ?? "");
	// Also on a read-only card: "?" alone says little.
	const cellLabel = (row: CardPlayerRow, p: number, i: number) =>
		row.cells[i].missing
			? [
					editLabel(i) ?? fmt(t.score.title, { n: label(i) }),
					fmt(t.scorecard.missing, { name: players[p]?.name ?? "" }),
				].join(", ")
			: editLabel(i);

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
										accessibilityLabel={editLabel(i)}
										style={[styles.cell, i === currentHole && styles.current]}
									>
										<AppText variant="label" style={styles.headText}>
											{label(i)}
										</AppText>
									</Pressable>
								))}
								<View style={[styles.cell, styles.sumCell]}>
									<AppText
										variant="label"
										numberOfLines={1}
										style={styles.headText}
									>
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
											accessibilityLabel={cellLabel(row, p, i)}
											accessibilityHint={strokesHint(p, i)}
											style={styles.cell}
										>
											<StrokeDots count={received?.[p]?.[i] ?? 0} />
											<Marked
												mark={row.cells[i].mark}
												text={cellText(row.cells[i])}
												missing={row.cells[i].missing}
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
							{gameRows.map(({ label: name, cells }, g) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: one row per side, fixed order
								<View key={g} style={[styles.row, styles.gameRow]}>
									<NameCell text={name} />
									{indices.map((i) => (
										<View key={i} style={styles.cell}>
											<GameChip cell={cells[i]} />
										</View>
									))}
									<View style={[styles.cell, styles.sumCell]} />
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

/** Handicap strokes on a hole: a dot each, in the cell's corner. */
function StrokeDots({ count }: { count: number }) {
	const styles = useThemedStyles(createStyles);
	if (count <= 0) return null;
	return (
		<View style={styles.dots} pointerEvents="none">
			{Array.from({ length: count }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: identical dots
				<View key={i} style={styles.dot} />
			))}
		</View>
	);
}

function GameChip({ cell }: { cell: GameCell | null }) {
	const styles = useThemedStyles(createStyles);
	if (!cell) return null;
	return (
		<View
			accessible
			accessibilityLabel={cell.spoken}
			style={[styles.chip, styles[CHIP_STYLES[cell.tone]]]}
		>
			<AppText
				variant="caption"
				maxFontSizeMultiplier={1.1}
				style={[
					styles.chipText,
					cell.tone === "accent" && styles.onAccent,
					cell.tone === "ink" && styles.onInk,
					cell.tone === "plain" && styles.plainText,
				]}
			>
				{cell.text}
			</AppText>
		</View>
	);
}

const CHIP_STYLES = {
	accent: "chipAccent",
	ink: "chipInk",
	outline: "chipOutline",
	dashed: "chipDashed",
	plain: "chipPlain",
} as const;

function Marked({
	mark,
	text,
	missing,
}: {
	mark: ScoreMark | null;
	text: string;
	missing: boolean;
}) {
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
					missing && styles.missing,
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
		gameRow: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		dots: {
			position: "absolute",
			top: 2,
			right: 1,
			flexDirection: "row",
			gap: 1,
		},
		dot: {
			width: 5,
			height: 5,
			borderRadius: 2.5,
			backgroundColor: colors.accent,
		},
		chip: {
			minWidth: CELL - 2,
			minHeight: 22,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.sm,
			borderWidth: 1.5,
		},
		chipAccent: {
			backgroundColor: colors.accentFill,
			borderColor: colors.accentFill,
		},
		chipInk: { backgroundColor: colors.text, borderColor: colors.text },
		chipOutline: { borderColor: colors.text },
		chipDashed: { borderColor: colors.text, borderStyle: "dashed" },
		chipPlain: { borderColor: "transparent" },
		chipText: {
			color: colors.text,
			fontWeight: "700",
			fontVariant: ["tabular-nums"],
		},
		onAccent: { color: colors.onAccent },
		onInk: { color: colors.bg },
		plainText: { color: colors.textMuted },
		nameCell: { width: 52, paddingRight: spacing.xs },
		cell: {
			width: CELL,
			height: CELL + 8,
			alignItems: "center",
			justifyContent: "center",
		},
		// Fits "Totaal" (nl) on one line at the default text size.
		sumCell: { width: CELL + 24 },
		current: { backgroundColor: colors.accentDim, borderRadius: radius.sm },
		headText: { color: colors.text, fontWeight: "700" },
		num: { fontVariant: ["tabular-nums"], textAlign: "center" },
		sum: { fontWeight: "800" },
		missing: { color: colors.danger, fontWeight: "700" },
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
