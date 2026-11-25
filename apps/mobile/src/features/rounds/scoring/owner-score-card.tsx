import { hasFairway } from "@fairway/core/round";
import { SymbolView } from "expo-symbols";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import {
	showActionSheet,
	showAlert,
} from "../../../monitoring/native-presentation";
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
	fewerPutts,
	ownerQuickStrokes,
	resultBadge,
	type ScoreDraft,
	type ScoreDraftPatch,
} from "./score-model";
import { TeeShotBands } from "./tee-shot-bands";

/** The account owner's hole: score, tee shot, putts, bunker and penalties. */
export function OwnerScoreCard({
	name,
	par,
	draft,
	received,
	stableford,
	game,
	onChange,
}: {
	name: string;
	par: number;
	draft: ScoreDraft;
	/** Handicap strokes on this hole. */
	received: number;
	stableford: boolean;
	game?: { points: number | null };
	onChange: (patch: ScoreDraftPatch) => void;
}) {
	const { t } = useI18n();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const strokes = draft.strokes ?? par;

	const setStrokes = (next: number) => {
		haptics.selectionChanged();
		onChange({ strokes: next, nr: false });
	};
	const togglePickedUp = () => {
		haptics.selectionChanged();
		onChange({ nr: !draft.nr });
	};
	const openMenu = () => {
		const action = draft.nr ? t.score.undoPickedUp : t.score.pickedUp;
		if (Platform.OS === "ios") {
			showActionSheet(
				{ options: [action, t.common.cancel], cancelButtonIndex: 1 },
				(index) => index === 0 && togglePickedUp(),
			);
			return;
		}
		showAlert(name, undefined, [
			{ text: action, onPress: togglePickedUp },
			{ text: t.common.cancel, style: "cancel" },
		]);
	};

	return (
		<View style={styles.card}>
			<View style={styles.head}>
				<PlayerAvatar name={name} size={34} />
				<AppText variant="row" numberOfLines={1} style={styles.name}>
					{name}
				</AppText>
				<View style={styles.badge}>
					<AppText variant="label" numberOfLines={1} style={styles.badgeText}>
						{resultBadge({
							draft,
							par,
							received,
							stableford,
							game,
							copy: t.score,
						})}
					</AppText>
				</View>
				<RoundButton
					label={t.score.more}
					glyph="⋯"
					size={34}
					background={colors.surface}
					onPress={openMenu}
				/>
			</View>

			<View style={styles.hero}>
				<RoundButton
					label={fmt(t.common.decrease, { label: t.score.strokes })}
					glyph="−"
					size={52}
					background={colors.surface2}
					disabled={!draft.nr && strokes <= 1}
					// Back from picked up: the score it had.
					onPress={() => setStrokes(draft.nr ? strokes : strokes - 1)}
				/>
				<Pressable
					onLongPress={togglePickedUp}
					accessibilityRole="text"
					accessibilityLabel={`${t.score.strokes}: ${draft.nr ? t.score.pickedUp : strokes}`}
					accessibilityHint={t.score.pickedUpHint}
					accessibilityLiveRegion="polite"
					style={styles.heroValue}
				>
					<AppText
						variant="hero"
						maxFontSizeMultiplier={1.1}
						style={styles.heroNumber}
					>
						{draft.nr ? "–" : strokes}
					</AppText>
				</Pressable>
				<RoundButton
					label={fmt(t.common.increase, { label: t.score.strokes })}
					glyph="+"
					size={52}
					background={colors.surface2}
					onPress={() => setStrokes(draft.nr ? strokes : strokes + 1)}
				/>
			</View>

			<View
				style={styles.quickRow}
				accessibilityRole="radiogroup"
				accessibilityLabel={fmt(t.score.strokesFor, { name })}
			>
				{ownerQuickStrokes(par).map((n) => {
					const selected = !draft.nr && strokes === n;
					return (
						<Pressable
							key={n}
							onPress={() => setStrokes(n)}
							accessibilityRole="radio"
							accessibilityLabel={String(n)}
							accessibilityState={{ checked: selected }}
							hitSlop={{ top: 2, bottom: 2 }}
							style={({ pressed }) => [
								styles.quick,
								selected && styles.selected,
								pressed && styles.pressed,
							]}
						>
							<AppText
								variant="control"
								maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
								style={[styles.digit, selected && styles.selectedText]}
							>
								{n}
							</AppText>
						</Pressable>
					);
				})}
			</View>

			{hasFairway(par) ? (
				<TeeShotBands draft={draft} onChange={onChange} />
			) : null}

			<View style={styles.tiles}>
				<CountTile
					label={t.score.putts}
					value={draft.putts}
					startAt={2}
					onDecrease={(putts) => onChange({ putts: fewerPutts(putts) })}
					onChange={(putts) => onChange({ putts })}
				/>
				<View style={styles.tile}>
					<AppText
						variant="caption"
						numberOfLines={1}
						maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
						style={styles.tileLabel}
						importantForAccessibility="no"
						accessibilityElementsHidden
					>
						{t.score.bunker.toUpperCase()}
					</AppText>
					<Pressable
						onPress={() => {
							haptics.selectionChanged();
							onChange({ bunker: !draft.bunker });
						}}
						accessibilityRole="switch"
						accessibilityLabel={t.score.bunker}
						accessibilityState={{ checked: draft.bunker }}
						style={({ pressed }) => [
							styles.toggle,
							draft.bunker && styles.toggleOn,
							pressed && styles.pressed,
						]}
					>
						<SymbolView
							name={{
								ios: draft.bunker ? "checkmark" : "xmark",
								android: draft.bunker ? "check" : "close",
							}}
							size={14}
							tintColor={draft.bunker ? colors.onSand : colors.textMuted}
						/>
						<AppText
							variant="label"
							maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
							style={draft.bunker ? styles.toggleTextOn : styles.toggleText}
						>
							{draft.bunker ? t.score.yes : t.score.no}
						</AppText>
					</Pressable>
				</View>
				<CountTile
					label={t.score.penalties}
					value={draft.penalties}
					onChange={(penalties) => onChange({ penalties })}
				/>
			</View>
		</View>
	);
}

function CountTile({
	label,
	value,
	startAt = 1,
	onDecrease,
	onChange,
}: {
	label: string;
	/** null: not entered yet; the first + lands on `startAt`. */
	value: number | null;
	startAt?: number;
	/** Takes over −, also below zero. */
	onDecrease?: (value: number) => void;
	onChange: (value: number) => void;
}) {
	const { t } = useI18n();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const set = (next: number) => {
		haptics.selectionChanged();
		onChange(next);
	};
	const decrease = (from: number) => {
		if (!onDecrease) return set(from - 1);
		haptics.selectionChanged();
		onDecrease(from);
	};
	return (
		<View style={styles.tile}>
			<AppText
				variant="caption"
				numberOfLines={1}
				maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
				style={styles.tileLabel}
				importantForAccessibility="no"
				accessibilityElementsHidden
			>
				{label.toUpperCase()}
			</AppText>
			<View style={styles.count}>
				<RoundButton
					label={fmt(t.common.decrease, { label })}
					glyph="−"
					size={36}
					background={colors.surface}
					disabled={value === null || (value === 0 && !onDecrease)}
					onPress={() => value !== null && decrease(value)}
				/>
				<AppText
					variant="title"
					maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
					accessibilityLabel={`${label}: ${value ?? "–"}`}
					accessibilityLiveRegion="polite"
					style={styles.digitStrong}
				>
					{value ?? "–"}
				</AppText>
				<RoundButton
					label={fmt(t.common.increase, { label })}
					glyph="+"
					size={36}
					background={colors.surface}
					onPress={() => set(value === null ? startAt : value + 1)}
				/>
			</View>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		card: {
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			padding: 14,
			gap: 12,
		},
		head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
		name: { flex: 1, minWidth: 0 },
		badge: {
			flexShrink: 1,
			backgroundColor: colors.accentDim,
			borderRadius: radius.pill,
			paddingHorizontal: 10,
			paddingVertical: spacing.xs,
		},
		badgeText: { color: colors.accentInk, fontWeight: "700" },
		hero: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 28,
		},
		heroValue: {
			minWidth: 88,
			minHeight: metrics.hitTarget,
			alignItems: "center",
		},
		heroNumber: { fontVariant: ["tabular-nums"], lineHeight: 74 },
		quickRow: {
			flexDirection: "row",
			justifyContent: "center",
			gap: spacing.sm,
		},
		quick: {
			width: 52,
			height: 40,
			borderRadius: radius.pill,
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
		digitStrong: { fontVariant: ["tabular-nums"] },
		tiles: { flexDirection: "row", gap: spacing.sm },
		tile: {
			flex: 1,
			minHeight: 84,
			paddingVertical: spacing.sm,
			paddingHorizontal: 3,
			gap: 6,
			alignItems: "center",
			backgroundColor: colors.bg,
			borderRadius: 16,
			borderCurve: "continuous",
		},
		tileLabel: { fontWeight: "700", letterSpacing: 0.2 },
		count: {
			flex: 1,
			alignSelf: "stretch",
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-evenly",
		},
		toggle: {
			flex: 1,
			alignSelf: "stretch",
			minHeight: metrics.hitTarget,
			marginHorizontal: 3,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: 6,
			borderRadius: radius.lg,
			borderCurve: "continuous",
			backgroundColor: colors.surface,
		},
		toggleOn: { backgroundColor: colors.sand },
		toggleText: { color: colors.text },
		toggleTextOn: { color: colors.onSand },
	});
