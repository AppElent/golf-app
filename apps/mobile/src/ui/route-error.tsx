/**
 * What a route renders when the render itself threw.
 *
 * expo-router calls a route file's exported `ErrorBoundary` with the error and
 * a `retry` that remounts the route. Without one, a throw anywhere in the
 * screen takes the whole navigator down to a red box in development and a blank
 * screen in production — with a tab bar the user can no longer use.
 *
 * Retry is the whole reason this exists, so it is a button and not a paragraph
 * asking someone to restart the app. The error's own message is shown in
 * development only: it is written for whoever wrote the code, not for whoever
 * is holding the phone.
 */
import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { reportError } from "../monitoring/report";
import { spacing, type Tokens, useThemedStyles, useTokens } from "../theme";
import { PrimaryButton } from "./button";
import { AppText } from "./text";

export function RouteError({
	title,
	body,
	retryLabel,
	onRetry,
	error,
}: {
	title: string;
	body: string;
	retryLabel: string;
	onRetry: () => void;
	error?: Error;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	useEffect(() => {
		if (!error) return;
		console.error("route.render", error);
		reportError(error);
	}, [error]);
	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<AppText variant="title">{title}</AppText>
			<AppText variant="caption">{body}</AppText>
			{__DEV__ && error?.message ? (
				<View style={styles.detail}>
					<AppText variant="caption" style={{ color: colors.danger }}>
						{error.message}
					</AppText>
				</View>
			) : null}
			<PrimaryButton
				label={retryLabel}
				onPress={onRetry}
				style={styles.action}
			/>
		</ScrollView>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: { padding: 20, gap: spacing.sm },
		detail: {
			backgroundColor: colors.surface,
			borderRadius: 12,
			padding: spacing.md,
		},
		action: { alignSelf: "flex-start", marginTop: spacing.md },
	});
