/** Shared by `segmented.ios.tsx` (SwiftUI `Picker`) and `segmented.tsx` (RN). */
export interface SegmentedOption<Value extends string> {
	value: Value;
	label: string;
	/** Spoken instead of the label, where the label alone is not a sentence. */
	accessibilityLabel?: string;
}

export interface SegmentedProps<Value extends string> {
	options: readonly SegmentedOption<Value>[];
	/** Compact labels may allow four visible choices before using a native menu. */
	maxSegments?: number;
	value: Value;
	onChange: (next: Value) => void;
}
