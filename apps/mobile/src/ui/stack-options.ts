import type { Stack } from "expo-router";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { Platform } from "react-native";
import { useTokens } from "../theme";

export type StackScreenOptions = Exclude<
	ComponentProps<typeof Stack>["screenOptions"],
	((...args: never[]) => unknown) | undefined
>;

/** What every stack shares: themed, with a flat app bar on Android. Memoized per palette. */
export function useBaseStackOptions(): StackScreenOptions {
	const colors = useTokens();
	return useMemo(
		() => ({
			headerTintColor: colors.accent,
			contentStyle: { backgroundColor: colors.bg },
			headerBackButtonDisplayMode: "minimal",
			...(Platform.OS === "android"
				? {
						headerStyle: { backgroundColor: colors.bg },
						headerTitleStyle: { color: colors.text },
						headerShadowVisible: false,
					}
				: {}),
		}),
		[colors],
	);
}
