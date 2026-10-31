/**
 * React Native drawing of the inset grouped list — Android, tests, and any
 * platform without the SwiftUI file. Foundry's rules, drawn by hand: one
 * `surface` group with `radius.card` corners, hairline separators inset from
 * the leading edge (never full-bleed), 48pt minimum rows, 17/600 titles over
 * 15pt secondary, press is a colour change to `surface2`.
 *
 * Rows with `actions` go through the gesture-handler `SwipeableRow`, which
 * already carries the swipe / long-press / VoiceOver contract.
 */

import { SymbolView } from "expo-symbols";
import {
	Children,
	Fragment,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { metrics, radius, spacing, useTokens } from "../theme";
import type {
	InsetListProps,
	InsetRowProps,
	RowLeading,
} from "./inset-list.types";
import { type RowAccessibilityProps, SwipeableRow } from "./swipeable-row";
import { AppText } from "./text";

export type { InsetListProps, InsetRowProps, RowLeading };

export function InsetList({
	compact = false,
	header,
	headerContent,
	footer,
	children,
}: InsetListProps) {
	const tokens = useTokens();
	return (
		<View style={styles.list}>
			{header ? (
				<AppText variant="footnote" style={styles.header}>
					{header.toUpperCase()}
				</AppText>
			) : null}
			<View
				style={[
					styles.group,
					{
						backgroundColor: tokens.surface,
						borderColor: tokens.border,
						...(compact
							? { borderRadius: radius.contentCard, borderWidth: 0 }
							: {}),
					},
				]}
			>
				{headerContent}
				{Children.toArray(children).map((row, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional; the list re-keys by content anyway
					<Fragment key={index}>
						{index > 0 ? (
							<View
								style={[
									styles.separator,
									{ backgroundColor: tokens.separator },
								]}
							/>
						) : null}
						{row}
					</Fragment>
				))}
			</View>
			{footer ? (
				<AppText variant="footnote" style={styles.footer}>
					{footer}
				</AppText>
			) : null}
		</View>
	);
}

function Leading({ leading }: { leading: RowLeading }) {
	const tokens = useTokens();
	if (isValidElement(leading)) return leading as ReactElement;
	return (
		<SymbolView
			name={leading.symbol}
			size={22}
			tintColor={tokens.accentInk}
			style={styles.symbol}
		/>
	);
}

export function InsetRow({
	leading,
	selected,
	title,
	secondary,
	value,
	trailing,
	chevron = false,
	destructive = false,
	onPress,
	actions,
	menuTitle,
	accessibilityLabel,
}: InsetRowProps) {
	const tokens = useTokens();
	const label =
		accessibilityLabel ?? (secondary ? `${title}, ${secondary}` : title);

	const body = (accessibility?: RowAccessibilityProps): ReactNode => (
		<View style={{ flexDirection: "row", alignItems: "center" }}>
			<Pressable
				onPress={onPress}
				disabled={!onPress && !accessibility}
				accessibilityRole={
					selected !== undefined ? "checkbox" : onPress ? "button" : undefined
				}
				accessibilityState={
					selected !== undefined ? { checked: selected } : undefined
				}
				accessibilityLabel={label}
				{...accessibility}
				style={({ pressed }) => [
					styles.row,
					{ flex: 1 },
					pressed && onPress ? { backgroundColor: tokens.surface2 } : null,
				]}
			>
				{leading ? <Leading leading={leading} /> : null}
				<View style={styles.text}>
					<AppText
						variant="row"
						numberOfLines={2}
						style={destructive ? { color: tokens.danger } : null}
					>
						{title}
					</AppText>
					{secondary ? (
						<AppText variant="footnote" numberOfLines={2}>
							{secondary}
						</AppText>
					) : null}
				</View>
				{!trailing && value ? (
					<AppText variant="secondary" style={styles.value}>
						{value}
					</AppText>
				) : null}
				{chevron ? (
					<AppText
						variant="row"
						style={[styles.chevron, { color: tokens.textFaint }]}
						accessibilityElementsHidden
						importantForAccessibility="no"
					>
						›
					</AppText>
				) : null}
			</Pressable>
			{trailing}
		</View>
	);

	const content =
		actions && actions.length > 0 ? (
			<SwipeableRow
				actions={actions}
				menuTitle={menuTitle ?? title}
				closeMenuLabel="Close"
			>
				{(accessibility) => body(accessibility)}
			</SwipeableRow>
		) : (
			body()
		);

	return <>{content}</>;
}

const styles = StyleSheet.create({
	list: { gap: spacing.sm },
	header: {
		letterSpacing: 0.4,
		paddingHorizontal: metrics.formGutter,
	},
	footer: { paddingHorizontal: metrics.formGutter },
	group: {
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
	text: { flex: 1, minWidth: 0, gap: 1 },
	value: { fontVariant: ["tabular-nums"] },
	chevron: { fontWeight: "400" },
	symbol: { width: 28, height: 28 },
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: metrics.separatorInset,
	},
});
