import { Host, Picker, Text } from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	pickerStyle,
	tag,
} from "@expo/ui/swift-ui/modifiers";
import { useWindowDimensions } from "react-native";
import { useAppearance } from "../theme";
import type { SegmentedProps } from "./segmented.types";

export type { SegmentedOption, SegmentedProps } from "./segmented.types";

/** Native selection; use a menu when a segmented row would truncate choices. */
export function Segmented<Value extends string>({
	options,
	maxSegments = 3,
	value,
	onChange,
}: SegmentedProps<Value>) {
	const { scheme, colors } = useAppearance();
	const { width, fontScale } = useWindowDimensions();
	const menu =
		fontScale > 1.2 ||
		options.length > maxSegments ||
		width < 350 ||
		options.some((option) => option.label.length > 20);
	return (
		<Host
			ignoreSafeArea="all"
			colorScheme={scheme}
			seedColor={colors.accent}
			matchContents={{ vertical: true }}
			style={{ minHeight: 44, width: "100%" }}
		>
			<Picker<Value>
				selection={value}
				onSelectionChange={onChange}
				modifiers={[pickerStyle(menu ? "menu" : "segmented")]}
			>
				{options.map((option) => (
					<Text
						key={option.value}
						modifiers={[
							tag(option.value),
							accessibilityLabel(option.accessibilityLabel ?? option.label),
						]}
					>
						{option.label}
					</Text>
				))}
			</Picker>
		</Host>
	);
}
