import type { ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { radius, useTokens } from "../theme";
export type GlassSurfaceProps = {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
	capsule?: boolean;
	tint?: string;
	/** Corner radius of a non-capsule surface; defaults to the sheet radius. */
	cornerRadius?: number;
};
export function GlassSurface({
	children,
	style,
	capsule,
	tint,
	cornerRadius = radius.sheet,
}: GlassSurfaceProps) {
	const colors = useTokens();
	return (
		<View
			style={[
				{
					backgroundColor: tint ?? colors.surface2,
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
