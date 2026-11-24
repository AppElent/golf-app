import { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { AppText } from "../../../ui/text";
import { PlayerAvatar } from "./player-avatar";
import { CIRCLE_FONT_SCALE, RoundButton } from "./round-button";
import {
	flightQuickStrokes,
	isOtherResult,
	type ScoreDraft,
	type ScoreDraftPatch,
	stepOther,
} from "./score-model";

/** Below this the name needs the avatar's and gaps' room (iPhone SE). */
const NARROW_WIDTH = 390;
const BUTTON = 40;

/** Another player's hole in one row: one tap for a score, ⋯ for the rest. */
export function FlightRow({
	name,
	par,
	draft,
	detail,
	onChange,
}: {
	name: string;
	par: number;
	draft: ScoreDraft;
	/** "+1 stroke · net 4". */
	detail: string;
	onChange: (patch: ScoreDraftPatch) => void;
}) {
	const { t } = useI18n();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const narrow = useWindowDimensions().width < NARROW_WIDTH;
	const [expanded, setExpanded] = useState(false);
	const other = isOtherResult(draft, par);

	const set = (patch: ScoreDraftPatch) => {
		haptics.selectionChanged();
		onChange(patch);
	};
	const button = (selected: boolean, pressed: boolean) => [
		styles.button,
		selected && styles.selected,
		pressed && styles.pressed,
	];
	const digit = (selected: boolean) => [
		styles.digit,
		selected && styles.selectedText,
	];

	return (
		<View>
			<View style={[styles.row, narrow && styles.rowNarrow]}>
				<PlayerAvatar name={name} size={narrow ? 28 : 34} />
				<View style={styles.text}>
					<AppText
						variant="control"
						numberOfLines={1}
						maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
					>
						{name}
					</AppText>
					{detail ? (
						<AppText
							variant="caption"
							numberOfLines={2}
							maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
						>
							{detail}
						</AppText>
					) : null}
				</View>
				<View
					style={styles.buttons}
					accessibilityRole="radiogroup"
					accessibilityLabel={fmt(t.score.strokesFor, { name })}
				>
					{flightQuickStrokes(par).map((n) => {
						const selected = !draft.nr && draft.strokes === n;
						return (
							<Pressable
								key={n}
								onPress={() => {
									set({ strokes: n, nr: false });
									setExpanded(false);
								}}
								accessibilityRole="radio"
								accessibilityLabel={`${name}: ${n}`}
								accessibilityState={{ checked: selected }}
								hitSlop={HIT_SLOP}
								style={({ pressed }) => button(selected, pressed)}
							>
								<AppText
									variant="control"
									maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
									style={digit(selected)}
								>
									{n}
								</AppText>
							</Pressable>
						);
					})}
					<Pressable
						onPress={() => setExpanded(!expanded)}
						accessibilityRole="button"
						accessibilityLabel={fmt(t.score.otherFor, { name })}
						accessibilityValue={
							other
								? {
										text: draft.nr ? t.score.pickedUp : String(draft.strokes),
									}
								: undefined
						}
						accessibilityState={{ expanded, selected: other }}
						hitSlop={HIT_SLOP}
						style={({ pressed }) => button(other, pressed)}
					>
						<AppText
							variant="control"
							maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
							style={digit(other)}
						>
							{draft.nr ? "–" : other ? draft.strokes : "⋯"}
						</AppText>
					</Pressable>
				</View>
			</View>
			{expanded ? (
				<View style={styles.other}>
					<Pressable
						onPress={() => set({ nr: !draft.nr })}
						accessibilityRole="switch"
						accessibilityLabel={`${name}: ${t.score.pickedUp}`}
						accessibilityState={{ checked: draft.nr }}
						style={({ pressed }) => [
							styles.pickedUp,
							draft.nr && styles.selected,
							pressed && styles.pressed,
						]}
					>
						<AppText
							variant="label"
							maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
							style={digit(draft.nr)}
						>
							{t.score.pickedUp}
						</AppText>
					</Pressable>
					<View style={styles.stepper}>
						<RoundButton
							label={fmt(t.common.decrease, {
								label: fmt(t.score.strokesFor, { name }),
							})}
							glyph="−"
							size={BUTTON}
							background={colors.surface2}
							disabled={draft.strokes === 1}
							onPress={() =>
								set({
									strokes: stepOther(draft.strokes, par, -1),
									nr: false,
								})
							}
						/>
						<AppText
							variant="title"
							maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
							accessibilityLiveRegion="polite"
							style={styles.value}
						>
							{draft.nr ? "–" : (draft.strokes ?? "–")}
						</AppText>
						<RoundButton
							label={fmt(t.common.increase, {
								label: fmt(t.score.strokesFor, { name }),
							})}
							glyph="+"
							size={BUTTON}
							background={colors.surface2}
							onPress={() =>
								set({ strokes: stepOther(draft.strokes, par, 1), nr: false })
							}
						/>
					</View>
				</View>
			) : null}
		</View>
	);
}

const HIT_SLOP = { top: 10, bottom: 10, left: 2, right: 2 };

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		row: {
			minHeight: 64,
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			paddingLeft: 12,
			paddingRight: 10,
			paddingVertical: spacing.xs,
		},
		rowNarrow: { gap: 6, paddingLeft: spacing.sm, paddingRight: spacing.sm },
		text: { flex: 1, minWidth: 0, gap: 1 },
		buttons: { flexDirection: "row", gap: spacing.xs },
		button: {
			width: BUTTON,
			height: BUTTON,
			borderRadius: BUTTON / 2,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.bg,
		},
		selected: { backgroundColor: colors.accentFill },
		selectedText: { color: colors.onAccent },
		pressed: { opacity: 0.7 },
		digit: {
			color: colors.textMuted,
			fontWeight: "700",
			fontVariant: ["tabular-nums"],
		},
		other: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: spacing.sm,
			paddingHorizontal: 12,
			paddingBottom: 12,
		},
		pickedUp: {
			minHeight: metrics.hitTarget,
			justifyContent: "center",
			paddingHorizontal: spacing.md,
			borderRadius: radius.pill,
			backgroundColor: colors.bg,
		},
		stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
		value: {
			minWidth: 40,
			textAlign: "center",
			fontVariant: ["tabular-nums"],
		},
	});
