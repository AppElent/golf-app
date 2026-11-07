/** Themed Pressables; `segmented.ios.tsx` delegates to a native SwiftUI picker. */
import { Pressable, StyleSheet, View } from "react-native";
import { metrics, radius, spacing, useTokens } from "../theme";
import {
	MAX_SEGMENTS,
	type SegmentedProps,
	useLabelsFit,
} from "./segmented.shared";
import { AppText } from "./text";

export function Segmented<Value extends string>({
	options,
	value,
	onChange,
}: SegmentedProps<Value>) {
	const colors = useTokens();
	const stacked = !useLabelsFit(options);
	const wrap = stacked || options.length > MAX_SEGMENTS;
	return (
		<View style={[styles.row, wrap && { flexWrap: "wrap" }]}>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<Pressable
						key={option.value}
						accessibilityRole="button"
						accessibilityState={{ selected }}
						accessibilityLabel={option.label}
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
		minHeight: metrics.hitTarget,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.sm,
		borderWidth: 1,
		borderRadius: radius.lg,
	},
});
