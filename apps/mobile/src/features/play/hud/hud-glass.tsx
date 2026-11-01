/**
 * A control surface floating over the hole: Liquid Glass on iOS 26, a dark
 * translucent fill elsewhere (imagery stays readable behind both). Always
 * dark-on-imagery, whatever the app's appearance.
 */
import type { ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { course, radius } from "../../../theme";
import { GlassSurface } from "../../../ui/glass-surface";
import { isIOS26OrLater } from "../../../ui/platform";

export function HudGlass({
	children,
	style,
	capsule = true,
	cornerRadius = radius.cardLg,
}: {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
	capsule?: boolean;
	cornerRadius?: number;
}) {
	if (isIOS26OrLater()) {
		return (
			<GlassSurface
				capsule={capsule}
				cornerRadius={cornerRadius}
				tint="rgba(0, 0, 0, 0.25)"
				style={style}
			>
				{children}
			</GlassSurface>
		);
	}
	return (
		<View
			style={[
				{
					backgroundColor: course.hudFill,
					borderRadius: capsule ? radius.pill : cornerRadius,
					borderCurve: "continuous",
				},
				style,
			]}
		>
			{children}
		</View>
	);
}
