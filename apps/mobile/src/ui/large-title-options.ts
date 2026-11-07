import { useMemo } from "react";
import { Platform } from "react-native";
import { useTokens } from "../theme";
import { type StackScreenOptions, useBaseStackOptions } from "./stack-options";

/** Tab-root stack options: iOS large titles over a transparent (glass-ready)
 *  header; Android keeps a flat themed app bar. Memoized per palette. */
export function useLargeTitleOptions(): StackScreenOptions {
	const colors = useTokens();
	const baseOptions = useBaseStackOptions();
	return useMemo(
		() => ({
			...baseOptions,
			...(Platform.OS === "ios"
				? {
						headerLargeTitle: true,
						headerTransparent: true,
						headerLargeTitleShadowVisible: false,
						headerLargeStyle: { backgroundColor: "transparent" },
						headerTitleStyle: { color: colors.text },
						headerLargeTitleStyle: { color: colors.text },
					}
				: {}),
		}),
		[baseOptions, colors],
	);
}
