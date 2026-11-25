import { Children, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { metrics, radius, spacing, useTokens } from "../theme";
import { AppText } from "./text";

type ChoiceProps = {
	label: string;
	detail?: string;
	selected: boolean;
	/** Drawn dashed: it can't be chosen now; say why beside it. */
	disabled?: boolean;
	onPress: () => void;
	/** Spoken instead of the label and detail. */
	accessibilityLabel?: string;
};

/** Ground, edge and ink of a choice: filled when selected, outlined otherwise. */
function useChoiceColors({ selected, disabled = false }: ChoiceProps) {
	const colors = useTokens();
	return {
		ink: selected ? colors.onAccent : disabled ? colors.textMuted : colors.text,
		detail: selected ? colors.onAccent : colors.textMuted,
		ground: (pressed: boolean) => ({
			backgroundColor: selected
				? pressed
					? colors.accentPressed
					: colors.accentFill
				: disabled
					? "transparent"
					: pressed
						? colors.surface2
						: colors.surface,
			borderColor: selected ? colors.accentFill : colors.borderStrong,
		}),
	};
}

function useChoiceAccessibility({
	label,
	detail,
	selected,
	disabled = false,
	accessibilityLabel,
}: ChoiceProps) {
	return {
		accessibilityRole: "radio" as const,
		accessibilityState: { checked: selected, disabled },
		accessibilityLabel:
			accessibilityLabel ?? (detail ? `${label}, ${detail}` : label),
	};
}

/** A two-column grid of `ChoiceTile`s; an odd last tile keeps its column. */
export function ChoiceGrid({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	const tiles = Children.toArray(children);
	const rows = Array.from({ length: Math.ceil(tiles.length / 2) }, (_, row) =>
		tiles.slice(row * 2, row * 2 + 2),
	);
	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabel={label}
			style={styles.grid}
		>
			{rows.map((row, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional; tiles keep their own keys
				<View key={index} style={styles.row}>
					{row}
					{row.length === 1 ? <View style={styles.filler} /> : null}
				</View>
			))}
		</View>
	);
}

export function ChoiceTile(props: ChoiceProps) {
	const colors = useChoiceColors(props);
	return (
		<Pressable
			onPress={props.onPress}
			disabled={props.disabled}
			{...useChoiceAccessibility(props)}
			style={({ pressed }) => [
				styles.tile,
				colors.ground(pressed),
				props.disabled && styles.dashed,
			]}
		>
			<AppText variant="control" style={{ color: colors.ink }}>
				{props.label}
			</AppText>
			{props.detail ? (
				<AppText variant="caption" style={{ color: colors.detail }}>
					{props.detail}
				</AppText>
			) : null}
		</Pressable>
	);
}

/** A pill for a horizontal row of choices. */
export function ChoiceChip({
	leading,
	...props
}: ChoiceProps & { leading?: ReactNode }) {
	const colors = useChoiceColors(props);
	return (
		<Pressable
			onPress={props.onPress}
			{...useChoiceAccessibility(props)}
			style={({ pressed }) => [styles.chip, colors.ground(pressed)]}
		>
			{leading}
			<AppText variant="control" style={{ color: colors.ink }}>
				{props.label}
			</AppText>
			{props.detail ? (
				<AppText variant="footnote" style={{ color: colors.detail }}>
					{props.detail}
				</AppText>
			) : null}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	grid: { gap: spacing.sm },
	row: { flexDirection: "row", gap: spacing.sm },
	filler: { flex: 1 },
	tile: {
		flex: 1,
		minHeight: 58,
		justifyContent: "center",
		gap: 3,
		paddingVertical: spacing.sm,
		paddingHorizontal: 12,
		borderRadius: radius.card,
		borderCurve: "continuous",
		borderWidth: 1.5,
	},
	dashed: { borderStyle: "dashed" },
	chip: {
		minHeight: metrics.hitTarget,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingHorizontal: 14,
		borderRadius: radius.pill,
		borderWidth: 1.5,
	},
});
