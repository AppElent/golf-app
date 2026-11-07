/** Shared by `segmented.ios.tsx` (SwiftUI `Picker`) and `segmented.tsx` (RN). */
import { useWindowDimensions } from "react-native";

export interface SegmentedOption<Value extends string> {
	value: Value;
	label: string;
}

export interface SegmentedProps<Value extends string> {
	options: readonly SegmentedOption<Value>[];
	value: Value;
	onChange: (next: Value) => void;
}

/** More choices than this do not sit side by side. */
export const MAX_SEGMENTS = 3;

/** Whether the labels still read in one row at this width and text size. */
export function useLabelsFit(
	options: readonly SegmentedOption<string>[],
): boolean {
	const { width, fontScale } = useWindowDimensions();
	return (
		fontScale <= 1.2 &&
		width >= 350 &&
		options.every((option) => option.label.length <= 20)
	);
}
