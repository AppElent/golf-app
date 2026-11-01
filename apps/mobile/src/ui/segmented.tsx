/**
 * A row of mutually exclusive choices. The language switch is the first one; a
 * unit switch and a goal-direction switch are the obvious next.
 *
 * Android uses themed Pressables; the iOS adapter delegates selection to a
 * native SwiftUI picker and accommodates long labels with a menu.
 *
 * Selection is announced, not only drawn. `accessibilityState.selected` is what
 * makes this a set of choices to a screen reader instead of N buttons with
 * different backgrounds, and it is why colour is never the only signal.
 */
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { radius, spacing, useTokens } from "../theme";
import type { SegmentedProps } from "./segmented.types";
import { AppText } from "./text";

export type { SegmentedOption, SegmentedProps } from "./segmented.types";

export function Segmented<Value extends string>({
	options,
	value,
	onChange,
}: SegmentedProps<Value>) {
	const colors = useTokens();
	const { width, fontScale } = useWindowDimensions();
	const stacked =
		fontScale > 1.2 ||
		width < 350 ||
		options.some((option) => option.label.length > 20);
	const wrap = stacked || options.length > 3;
	return (
		<View style={[styles.row, wrap && { flexWrap: "wrap" }]}>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<Pressable
						key={option.value}
						accessibilityRole="button"
						accessibilityState={{ selected }}
						accessibilityLabel={option.accessibilityLabel ?? option.label}
						onPress={() => onChange(option.value)}
						style={({ pressed }) => [
							styles.option,
							wrap && { flexBasis: stacked ? "100%" : "45%", flexGrow: 1 },
							{
								backgroundColor: selected ? colors.accentFill : colors.surface,
								borderColor: selected ? colors.accent : colors.border,
							},
							pressed && !selected
								? { backgroundColor: colors.surface2 }
								: null,
						]}
					>
						<AppText
							style={{
								fontWeight: "700",
								color: selected ? colors.onAccent : colors.text,
							}}
						>
							{option.label}
						</AppText>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", gap: spacing.sm },
	option: {
		flex: 1,
		// 44pt: the platform minimum hit target, which a language switch has no
		// excuse to fall under.
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.sm,
		borderWidth: 1,
		borderRadius: radius.lg,
	},
});
