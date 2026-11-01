/**
 * Placeholders shaped like the content they stand in for, so the layout does
 * not jump when data arrives. Deliberately still: nothing shimmers or loops,
 * which is how Reduce Motion is honoured without a branch (Foundry, "Motion").
 * A screen shows one `SkeletonGroup` per region with a spoken label, not a
 * "Loading…" string.
 */
import type { ReactNode } from "react";
import { type DimensionValue, StyleSheet, View } from "react-native";
import { metrics, radius, spacing, useTokens } from "../theme";

export function SkeletonBlock({
	width = "100%",
	height = 14,
	style,
}: {
	width?: DimensionValue;
	height?: number;
	style?: object;
}) {
	const tokens = useTokens();
	return (
		<View
			style={[
				{
					width,
					height,
					borderRadius: Math.min(height / 2, radius.md),
					backgroundColor: tokens.surface2,
				},
				style,
			]}
		/>
	);
}

export function SkeletonGroup({
	label,
	children,
}: {
	/** Spoken once for the whole region. */
	label: string;
	children: ReactNode;
}) {
	return (
		<View accessible accessibilityLabel={label} style={styles.group}>
			{children}
		</View>
	);
}

/** An inset grouped list: `rows` rows of leading tile, title and secondary line. */
export function SkeletonList({
	rows = 3,
	leading = true,
}: {
	rows?: number;
	leading?: boolean;
}) {
	const tokens = useTokens();
	return (
		<View
			style={[
				styles.list,
				{ backgroundColor: tokens.surface, borderColor: tokens.border },
			]}
		>
			{Array.from({ length: rows }, (_, i) => (
				<View
					// biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
					key={i}
					style={[
						styles.row,
						i > 0 && {
							borderTopWidth: StyleSheet.hairlineWidth,
							borderTopColor: tokens.separator,
						},
					]}
				>
					{leading ? (
						<SkeletonBlock width={30} height={30} style={styles.tile} />
					) : null}
					<View style={styles.lines}>
						<SkeletonBlock width="55%" height={14} />
						<SkeletonBlock width="35%" height={11} />
					</View>
				</View>
			))}
		</View>
	);
}

/** A content card: a title line and `lines` body lines. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
	const tokens = useTokens();
	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: tokens.surface, borderColor: tokens.border },
			]}
		>
			<SkeletonBlock width="40%" height={12} />
			{Array.from({ length: lines }, (_, i) => (
				<SkeletonBlock
					// biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
					key={i}
					width={i === lines - 1 ? "60%" : "90%"}
					height={14}
				/>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	group: { gap: spacing.md },
	list: {
		borderRadius: radius.card,
		borderCurve: "continuous",
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		minHeight: metrics.rowMinHeight,
		paddingVertical: spacing.sm,
		paddingHorizontal: metrics.formGutter,
	},
	tile: { borderRadius: 30 * 0.32 },
	lines: { flex: 1, gap: 6 },
	card: {
		gap: spacing.sm,
		borderRadius: radius.cardLg,
		borderCurve: "continuous",
		borderWidth: 1,
		padding: spacing.md,
	},
});
