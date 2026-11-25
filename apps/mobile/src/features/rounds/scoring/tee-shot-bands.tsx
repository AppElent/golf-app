import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import {
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { AppText } from "../../../ui/text";
import { CIRCLE_FONT_SCALE } from "./round-button";
import {
	pickTeeShot,
	type ScoreDraft,
	type ScoreDraftPatch,
	type TeeShot,
	teeShotOf,
} from "./score-model";

/** The fairway from above: rough left, fairway, rough right. */
export function TeeShotBands({
	draft,
	onChange,
}: {
	draft: ScoreDraft;
	onChange: (patch: ScoreDraftPatch) => void;
}) {
	const { t } = useI18n();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const selected = teeShotOf(draft);
	const band = (shot: TeeShot) => {
		const on = selected === shot;
		const miss = shot !== "fairway";
		const ink = on ? (miss ? colors.bg : colors.onAccent) : colors.text;
		return {
			accessibilityRole: "radio" as const,
			// Set, or VoiceOver reads the symbol's name before the label.
			accessibilityLabel: t.score.teeShots[shot],
			accessibilityState: { checked: on },
			onPress: () => {
				haptics.selectionChanged();
				onChange(pickTeeShot(draft, shot));
			},
			style: ({ pressed }: { pressed: boolean }) => [
				styles.band,
				styles[shot],
				on && (miss ? styles.missOn : styles.fairwayOn),
				pressed && styles.pressed,
			],
			children: (
				<>
					<SymbolView
						name={SYMBOLS[shot]}
						size={16}
						tintColor={ink}
						weight="semibold"
					/>
					<AppText
						variant="label"
						numberOfLines={1}
						maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
						style={{ color: ink }}
					>
						{t.score.teeShots[shot]}
					</AppText>
				</>
			),
		};
	};
	return (
		<View style={styles.section}>
			<AppText variant="caption" style={styles.label}>
				{t.score.teeShot.toUpperCase()}
			</AppText>
			<View
				style={styles.bands}
				accessibilityRole="radiogroup"
				accessibilityLabel={t.score.teeShot}
			>
				<Pressable {...band("left")} />
				<Pressable {...band("fairway")} />
				<Pressable {...band("right")} />
			</View>
		</View>
	);
}

const SYMBOLS = {
	left: { ios: "chevron.left", android: "chevron_left" },
	fairway: { ios: "flag", android: "flag" },
	right: { ios: "chevron.right", android: "chevron_right" },
} as const;

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		section: { gap: 6 },
		label: { fontWeight: "700", letterSpacing: 0.2 },
		bands: { flexDirection: "row", gap: spacing.xs, minHeight: 58 },
		band: {
			alignItems: "center",
			justifyContent: "center",
			gap: 2,
			borderRadius: 6,
			borderCurve: "continuous",
		},
		left: {
			flex: 1,
			backgroundColor: colors.surface2,
			borderTopLeftRadius: 16,
			borderBottomLeftRadius: 16,
		},
		fairway: { flex: 1.5, backgroundColor: colors.accentDim },
		right: {
			flex: 1,
			backgroundColor: colors.surface2,
			borderTopRightRadius: 16,
			borderBottomRightRadius: 16,
		},
		fairwayOn: { backgroundColor: colors.accentFill },
		missOn: { backgroundColor: colors.text },
		pressed: { opacity: 0.7 },
	});
