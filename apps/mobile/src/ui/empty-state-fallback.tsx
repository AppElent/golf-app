/**
 * What a region says when it holds nothing yet — the React Native drawing.
 * `empty-state.tsx` re-exports it; `empty-state.ios.tsx` uses it for the
 * inline appearance and the system `ContentUnavailableView` for "search".
 *
 * An empty list is not a blank rectangle: it is a place where something can be
 * put, and the fastest way to explain that is to say so and offer the action.
 * The `action` is optional because some empty regions genuinely have no next
 * step of their own — a meal slot's plus control sits in its header, so the
 * slot only needs the sentence.
 */
import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";
import { spacing, useTokens } from "../theme";
import { GhostButton } from "./button";
import { AppText } from "./text";

export interface EmptyStateProps {
	title?: string;
	/** One sentence saying what goes here. Never just "No data". */
	body: string;
	/** Omit when the region's add control lives in its header. */
	action?: { label: string; onPress: () => void };
	/** "search" centres the state in a tall region with a magnifier. */
	appearance?: "default" | "search";
}

export function EmptyState({
	title,
	body,
	action,
	appearance = "default",
}: EmptyStateProps) {
	const colors = useTokens();
	const search = appearance === "search";
	return (
		<View style={[styles.root, search && styles.search]}>
			{search ? (
				<SymbolView
					name={{ ios: "magnifyingglass", android: "search", web: "search" }}
					size={58}
					tintColor={colors.textFaint}
				/>
			) : null}
			{title ? <AppText variant="heading">{title}</AppText> : null}
			<AppText variant="caption" style={search ? styles.searchBody : undefined}>
				{body}
			</AppText>
			{action ? (
				<GhostButton
					label={action.label}
					onPress={action.onPress}
					style={styles.action}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { gap: spacing.sm },
	search: {
		minHeight: 320,
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.md,
		paddingHorizontal: spacing.xl,
		paddingVertical: spacing.xxl,
	},
	searchBody: { maxWidth: 320, textAlign: "center" },
	action: { alignSelf: "flex-start", marginTop: spacing.xs },
});
