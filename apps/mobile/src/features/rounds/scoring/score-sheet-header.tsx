import { Pressable, StyleSheet, View } from "react-native";
import { metrics, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";

/** The sheet's in-content header where it has no native toolbar. */
export function ScoreSheetHeader({
	title,
	cancelLabel,
	onCancel,
	saveLabel,
	onSave,
	saving,
}: {
	title: string;
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
			<AppText variant="heading" numberOfLines={2} style={styles.modalTitle}>
				{title}
			</AppText>
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
		modalTitle: { flex: 1, textAlign: "center" },
	});
