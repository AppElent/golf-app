import type { Stack } from "expo-router";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { Platform } from "react-native";
import { useTokens } from "../theme";

/** Tab-root stack options: iOS large titles over a transparent (glass-ready)
 *  header; Android keeps a flat themed app bar. Memoized per palette. */
type StackScreenOptions = Exclude<
	ComponentProps<typeof Stack>["screenOptions"],
	((...args: never[]) => unknown) | undefined
>;

export function useLargeTitleOptions(): StackScreenOptions {
	const colors = useTokens();
	return useMemo(
		() => ({
			headerTintColor: colors.accent,
			contentStyle: { backgroundColor: colors.bg },
			headerBackButtonDisplayMode: "minimal",
			...(Platform.OS === "ios"
				? {
						headerLargeTitle: true,
						headerTransparent: true,
						headerLargeTitleShadowVisible: false,
						headerLargeStyle: { backgroundColor: "transparent" },
						headerTitleStyle: { color: colors.text },
						headerLargeTitleStyle: { color: colors.text },
					}
				: {
						headerStyle: { backgroundColor: colors.bg },
						headerTitleStyle: { color: colors.text },
						headerShadowVisible: false,
					}),
		}),
		[colors],
	);
}
