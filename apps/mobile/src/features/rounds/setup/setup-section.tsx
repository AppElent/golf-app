import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../../../theme";
import { AppText } from "../../../ui/text";

/** A titled part of round setup: tiles, chips or a list, without a card. */
export function SetupSection({
	title,
	footer,
	children,
}: {
	title: string;
	footer?: string;
	children: ReactNode;
}) {
	return (
		<View style={styles.section}>
			<AppText variant="label" accessibilityRole="header" style={styles.text}>
				{title}
			</AppText>
			{children}
			{footer ? (
				<AppText variant="footnote" style={styles.text}>
					{footer}
				</AppText>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
	text: { paddingHorizontal: spacing.xs },
});
