import { Host, VStack } from "@expo/ui/swift-ui";
import { frame, glassEffect } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";

import { radius, useAppearance } from "../../../theme";
import { isIOS26OrLater } from "../../../ui/platform";
import { HudGlassFallback, type HudGlassProps } from "./hud-glass-fallback";

const TINT = "rgba(0, 0, 0, 0.25)";

export function HudGlass(props: HudGlassProps) {
	return isIOS26OrLater() ? (
		<LiquidGlass {...props} />
	) : (
		<HudGlassFallback {...props} />
	);
}

function LiquidGlass({ children, style, capsule = true }: HudGlassProps) {
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
								glass: { variant: "regular", tint: TINT },
								shape: capsule ? "capsule" : "roundedRectangle",
								cornerRadius: radius.cardLg,
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
