import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { metrics, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";

/** Between the native header buttons on an iPhone SE (375 pt wide). */
const NARROW_WIDTH = 390;
const NARROW_TITLE = 124;

/** "Hole 7" over "Par 4 · SI 3 · 352 m", in either header. */
export function HoleTitle({
	title,
	subtitle,
}: {
	title: string;
	subtitle: string;
}) {
	const styles = useThemedStyles(createStyles);
	const narrow = useWindowDimensions().width < NARROW_WIDTH;
	return (
		<View
			accessible
			accessibilityRole="header"
			accessibilityLabel={`${title}, ${subtitle}`}
			style={[styles.title, narrow && { maxWidth: NARROW_TITLE }]}
		>
			<AppText variant="titleSm" numberOfLines={1} maxFontSizeMultiplier={1.2}>
				{title}
			</AppText>
			<AppText
				variant="footnote"
				numberOfLines={1}
				// The buttons leave no room for a three-digit length: shrink, don't cut.
				adjustsFontSizeToFit={narrow}
				minimumFontScale={0.75}
				maxFontSizeMultiplier={1.2}
				style={styles.titleMeta}
			>
				{subtitle}
			</AppText>
		</View>
	);
}

/** The sheet's in-content header where it has no native toolbar. */
export function ScoreSheetHeader({
	title,
	subtitle,
	cancelLabel,
	onCancel,
	saveLabel,
	onSave,
	saving,
}: {
	title: string;
	subtitle: string;
	cancelLabel: string;
	onCancel: () => void;
	saveLabel: string;
	onSave: () => void;
	saving: boolean;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.modalHeader}>
			<Pressable
				onPress={onCancel}
				accessibilityRole="button"
				style={styles.headerAction}
			>
				<AppText style={styles.headerCancelText}>{cancelLabel}</AppText>
			</Pressable>
			<View style={styles.modalTitle}>
				<HoleTitle title={title} subtitle={subtitle} />
			</View>
			<Pressable
				onPress={onSave}
				disabled={saving}
				accessibilityRole="button"
				accessibilityState={{ disabled: saving, busy: saving }}
				style={[styles.headerAction, styles.headerActionTrailing]}
			>
				<AppText style={styles.headerActionText}>{saveLabel}</AppText>
			</Pressable>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		modalHeader: {
			minHeight: 52,
			paddingHorizontal: spacing.sm,
			flexDirection: "row",
			alignItems: "center",
		},
		headerAction: {
			minWidth: 76,
			minHeight: metrics.hitTarget,
			paddingHorizontal: spacing.sm,
			alignItems: "flex-start",
			justifyContent: "center",
		},
		headerCancelText: { color: colors.textMuted, fontWeight: "500" },
		headerActionText: { color: colors.accent, fontWeight: "700" },
		headerActionTrailing: { alignItems: "flex-end" },
		modalTitle: { flex: 1 },
		title: { alignItems: "center" },
		titleMeta: { fontVariant: ["tabular-nums"] },
	});
