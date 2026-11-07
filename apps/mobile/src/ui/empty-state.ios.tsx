/**
 * iOS: the "search" appearance is the system `ContentUnavailableView`, the view
 * Mail, Files and Settings show for "No results". The inline appearance has no
 * system counterpart and stays the RN drawing.
 */
import { ContentUnavailableView, Host } from "@expo/ui/swift-ui";
import { StyleSheet, View } from "react-native";
import { spacing, useAppearance, useTokens } from "../theme";
import {
	type EmptyStateProps,
	EmptyState as FallbackEmptyState,
} from "./empty-state-fallback";

export function EmptyState(props: EmptyStateProps) {
	const tokens = useTokens();
	const { scheme } = useAppearance();
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
