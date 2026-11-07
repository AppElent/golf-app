import type { ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { course, radius } from "../../../theme";

export interface HudGlassProps {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
	capsule?: boolean;
}

export function HudGlassFallback({
	children,
	style,
	capsule = true,
}: HudGlassProps) {
	return (
		<View
			style={[
				{
					backgroundColor: course.hudFill,
					borderRadius: capsule ? radius.pill : radius.cardLg,
					borderCurve: "continuous",
				},
				style,
			]}
		>
			{children}
		</View>
	);
}
