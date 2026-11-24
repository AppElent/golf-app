import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { metrics, spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";

/** A titled part of round setup: tiles, chips or a list, without a card. */
export function SetupSection({
	title,
	footer,
	footerLink,
	children,
}: {
	title: string;
	footer?: string;
	/** Follows the footer text; not shown without one. */
	footerLink?: { label: string; onPress: () => void };
	children: ReactNode;
}) {
	const colors = useTokens();
	return (
		<View style={styles.section}>
			<AppText variant="label" accessibilityRole="header" style={styles.text}>
				{title}
			</AppText>
			{children}
			{footer ? (
				<View style={[styles.text, styles.footer]}>
					<AppText variant="footnote">{footer}</AppText>
					{footerLink ? (
						<Pressable
							onPress={footerLink.onPress}
							accessibilityRole="button"
							accessibilityLabel={footerLink.label}
							style={({ pressed }) => [
								styles.footerLink,
								pressed && styles.pressed,
							]}
						>
							<AppText
								variant="footnote"
								style={[styles.footerLinkLabel, { color: colors.accent }]}
							>
								{footerLink.label} ›
							</AppText>
						</Pressable>
					) : null}
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
	footer: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		columnGap: spacing.xs,
	},
	// Full tap height, without pushing the footer away from its section.
	footerLink: {
		minHeight: metrics.hitTarget,
		marginVertical: -spacing.sm,
		justifyContent: "center",
	},
	footerLinkLabel: { fontWeight: "600" },
	pressed: { opacity: 0.6 },
	text: { paddingHorizontal: spacing.xs },
});
