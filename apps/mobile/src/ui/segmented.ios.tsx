import { Host, Picker, Text } from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	pickerStyle,
	tag,
} from "@expo/ui/swift-ui/modifiers";
import { metrics, useAppearance } from "../theme";
import {
	MAX_SEGMENTS,
	type SegmentedProps,
	useLabelsFit,
} from "./segmented.shared";

/** Native selection; use a menu when a segmented row would truncate choices. */
export function Segmented<Value extends string>({
	options,
	value,
	onChange,
}: SegmentedProps<Value>) {
	const { scheme, colors } = useAppearance();
	const menu = !useLabelsFit(options) || options.length > MAX_SEGMENTS;
	return (
		<Host
			ignoreSafeArea="all"
			colorScheme={scheme}
			seedColor={colors.accent}
			matchContents={{ vertical: true }}
			style={{ minHeight: metrics.hitTarget, width: "100%" }}
		>
			<Picker<Value>
				selection={value}
				onSelectionChange={onChange}
				modifiers={[pickerStyle(menu ? "menu" : "segmented")]}
			>
				{options.map((option) => (
					<Text
						key={option.value}
						modifiers={[tag(option.value), accessibilityLabel(option.label)]}
					>
						{option.label}
					</Text>
				))}
			</Picker>
		</Host>
	);
}
