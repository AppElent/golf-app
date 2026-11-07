import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet } from "react-native";
import { course, metrics } from "../../../theme";
import { HudGlass } from "./hud-glass";

type Symbol = ComponentProps<typeof SymbolView>["name"];

export function HudButton({
	symbol,
	label,
	onPress,
	disabled,
	active,
}: {
	symbol: Symbol;
	label: string;
	onPress: () => void;
	disabled?: boolean;
	active?: boolean;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled, selected: active }}
			disabled={disabled}
			onPress={onPress}
			hitSlop={6}
			style={({ pressed }) => [
				styles.hit,
				(pressed || disabled) && { opacity: disabled ? 0.35 : 0.7 },
			]}
		>
			<HudGlass style={[styles.button, active && styles.active]}>
				<SymbolView
					name={symbol}
					size={20}
					tintColor={active ? course.target : course.hudText}
				/>
			</HudGlass>
		</Pressable>
	);
}

const SIZE = metrics.hitTarget + 4;
const styles = StyleSheet.create({
	hit: { borderRadius: SIZE / 2 },
	button: {
		width: SIZE,
		height: SIZE,
		alignItems: "center",
		justifyContent: "center",
	},
	active: { borderWidth: 1.5, borderColor: course.target },
});
