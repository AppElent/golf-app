/**
 * iOS: the "search" appearance is the system `ContentUnavailableView` — the
 * same view Mail, Files and Settings show for "No results", with the
 * magnifier, title and description laid out by the OS. The inline appearance
 * (a sentence inside a card or a meal slot) has no system counterpart and
 * stays the RN drawing.
 */
import { ContentUnavailableView, Host } from "@expo/ui/swift-ui";
import { StyleSheet, View } from "react-native";
import { spacing, useHostScheme, useTokens } from "../theme";
import { GhostButton } from "./button";
import {
	type EmptyStateProps,
	EmptyState as FallbackEmptyState,
} from "./empty-state-fallback";

export type { EmptyStateProps };

export function EmptyState(props: EmptyStateProps) {
	const tokens = useTokens();
	const scheme = useHostScheme();
	if (props.appearance !== "search") return <FallbackEmptyState {...props} />;
	return (
		<View style={styles.search}>
			<Host
				ignoreSafeArea="all"
				colorScheme={scheme}
				seedColor={tokens.accent}
				matchContents={{ vertical: true }}
				style={styles.host}
			>
				<ContentUnavailableView
					title={props.title}
					systemImage="magnifyingglass"
					description={props.body}
				/>
			</Host>
			{props.action ? (
				<GhostButton
					label={props.action.label}
					onPress={props.action.onPress}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	search: {
		minHeight: 320,
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.md,
		paddingVertical: spacing.xl,
	},
	host: { width: "100%" },
});
