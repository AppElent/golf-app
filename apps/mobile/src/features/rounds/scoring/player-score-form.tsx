import { hasFairway } from "@fairway/core/round";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import {
	course,
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import {
	FormSegmentedRow,
	GroupedSurface,
	StepperField,
} from "../../../ui/form";
import { AppText } from "../../../ui/text";
import { quickStrokes, type ScoreDraft } from "./score-model";

export function PlayerScoreForm({
	name,
	par,
	draft,
	owner,
	onChange,
}: {
	name: string;
	par: number;
	draft: ScoreDraft;
	owner: boolean;
	onChange: (patch: Partial<ScoreDraft>) => void;
}) {
	const { t } = useI18n();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const yesNo = (value: boolean | null) =>
		value === null ? "unset" : value ? "hit" : "missed";
	const fromYesNo = (value: "unset" | "hit" | "missed") =>
		value === "unset" ? null : value === "hit";
	const yesNoOptions = [
		{ value: "unset" as const, label: "—" },
		{ value: "hit" as const, label: t.score.hit },
		{ value: "missed" as const, label: t.score.missed },
	];

	return (
		<View style={styles.player}>
			<AppText variant="label">{name}</AppText>
			<GroupedSurface style={styles.strokesSurface}>
				<View
					style={styles.quickRow}
					accessibilityRole="radiogroup"
					accessibilityLabel={fmt(t.score.strokesFor, { name })}
				>
					{quickStrokes(par).map((n) => {
						const selected = !draft.nr && draft.strokes === n;
						return (
							<Pressable
								key={n}
								onPress={() => {
									haptics.selectionChanged();
									onChange({ strokes: n, nr: false });
								}}
								accessibilityRole="radio"
								accessibilityState={{ checked: selected }}
								style={({ pressed }) => [
									styles.quick,
									n < par && styles.quickUnder,
									selected && styles.quickSelected,
									pressed && { opacity: 0.7 },
								]}
							>
								<AppText
									variant="title"
									style={[
										styles.quickText,
										selected && { color: colors.onAccent },
									]}
								>
									{n}
								</AppText>
							</Pressable>
						);
					})}
				</View>
				<StepperField
					label={t.score.strokes}
					value={draft.strokes}
					min={1}
					onChange={(strokes) => onChange({ strokes, nr: false })}
				/>
			</GroupedSurface>
			{owner ? (
				<>
					<View style={styles.statRow}>
						<View style={styles.statHalf}>
							<StepperField
								label={t.score.putts}
								value={draft.putts}
								startAt={2}
								onChange={(putts) => onChange({ putts })}
							/>
						</View>
						<View style={styles.statHalf}>
							<StepperField
								label={t.score.penalties}
								value={draft.penalties}
								onChange={(penalties) => onChange({ penalties })}
							/>
						</View>
					</View>
					{hasFairway(par) ? (
						<View style={styles.rowSurface}>
							<FormSegmentedRow
								label={t.score.fairway}
								options={yesNoOptions}
								value={yesNo(draft.fir)}
								onChange={(v) => onChange({ fir: fromYesNo(v) })}
							/>
						</View>
					) : null}
					<View style={styles.rowSurface}>
						<FormSegmentedRow
							label={t.score.green}
							options={yesNoOptions}
							value={yesNo(draft.gir)}
							onChange={(v) => onChange({ gir: fromYesNo(v) })}
						/>
					</View>
				</>
			) : null}
			<View style={styles.switchRow}>
				<View style={{ flex: 1 }}>
					<AppText>{t.score.pickedUp}</AppText>
					<AppText variant="footnote">{t.score.pickedUpHint}</AppText>
				</View>
				<Switch
					value={draft.nr}
					onValueChange={(nr) => onChange({ nr })}
					accessibilityLabel={t.score.pickedUp}
					trackColor={{ true: colors.accentFill }}
				/>
			</View>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		player: { gap: spacing.sm },
		strokesSurface: { gap: spacing.md },
		quickRow: { flexDirection: "row", justifyContent: "space-evenly" },
		quick: {
			width: 60,
			height: 60,
			borderRadius: radius.pill,
			borderWidth: 1.5,
			borderColor: colors.borderStrong,
			alignItems: "center",
			justifyContent: "center",
		},
		quickUnder: { borderColor: course.birdie },
		quickSelected: {
			backgroundColor: colors.accentFill,
			borderColor: colors.accentFill,
		},
		quickText: { fontVariant: ["tabular-nums"] },
		rowSurface: { backgroundColor: colors.surface, borderRadius: radius.lg },
		statRow: { flexDirection: "row", gap: spacing.sm },
		statHalf: { flex: 1 },
		switchRow: {
			minHeight: metrics.rowMinHeight,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.sm,
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
		},
	});
