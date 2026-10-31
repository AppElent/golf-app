import { Host, VStack } from "@expo/ui/swift-ui";
import { frame, glassEffect } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";
import { radius, useAppearance } from "../theme";
import type { GlassSurfaceProps } from "./glass-surface";
export function GlassSurface({
	children,
	style,
	capsule,
	tint,
	cornerRadius = radius.sheet,
}: GlassSurfaceProps) {
	const { scheme } = useAppearance();
	return (
		<View style={style}>
			<View
				pointerEvents="none"
				accessible={false}
				style={StyleSheet.absoluteFill}
			>
				<Host
					colorScheme={scheme}
					style={StyleSheet.absoluteFill}
					ignoreSafeArea="all"
				>
					<VStack
						spacing={0}
						modifiers={[
							frame({ maxWidth: Infinity, maxHeight: Infinity }),
							glassEffect({
								glass: { variant: "regular", ...(tint ? { tint } : {}) },
								shape: capsule ? "capsule" : "roundedRectangle",
								cornerRadius,
							}),
						]}
					>
						{null}
					</VStack>
				</Host>
			</View>
			{children}
		</View>
	);
}
