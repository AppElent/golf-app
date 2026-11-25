import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { metrics, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";

/** Digits in fixed-size circles: they grow a little, then the circle wins. */
export const CIRCLE_FONT_SCALE = 1.3;

/** A round − / + button with at least a 44 pt target. */
export function RoundButton({
	label,
	glyph,
	size,
	background,
	disabled,
	onPress,
}: {
	label: string;
	glyph: ReactNode;
	size: number;
	background: string;
	disabled?: boolean;
	onPress: () => void;
}) {
	const colors = useTokens();
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			hitSlop={Math.max(0, (metrics.hitTarget - size) / 2)}
			style={({ pressed }) => [
				styles.button,
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					backgroundColor: pressed ? colors.borderStrong : background,
				},
				disabled && styles.disabled,
			]}
		>
			<AppText variant="title" maxFontSizeMultiplier={CIRCLE_FONT_SCALE}>
				{glyph}
			</AppText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: { alignItems: "center", justifyContent: "center" },
	disabled: { opacity: 0.4 },
});
