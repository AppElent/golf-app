/** React Native drawing of the inset grouped list: Android and tests. */
import { SymbolView } from "expo-symbols";
import { Children, Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { metrics, radius, spacing, useTokens } from "../theme";
import {
	type InsetListProps,
	type InsetRowProps,
	rowSpokenLabel,
} from "./inset-list.shared";
import { type RowAccessibilityProps, SwipeableRow } from "./swipeable-row";
import { AppText } from "./text";

export function InsetList({ header, footer, children }: InsetListProps) {
	const tokens = useTokens();
	return (
		<View style={styles.list}>
			{header ? (
				<AppText variant="footnote" style={styles.header}>
					{header.toUpperCase()}
				</AppText>
			) : null}
			<View style={[styles.group, { backgroundColor: tokens.surface }]}>
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

export function InsetRow({
	leading,
	title,
	secondary,
	value,
	trailing,
	chevron = false,
	destructive = false,
	onPress,
	actions,
}: InsetRowProps) {
	const tokens = useTokens();

	const body = (accessibility?: RowAccessibilityProps) => (
		<View style={{ flexDirection: "row", alignItems: "center" }}>
			<Pressable
				onPress={onPress}
				disabled={!onPress && !accessibility}
				accessibilityRole={onPress ? "button" : undefined}
				accessibilityLabel={rowSpokenLabel({ title, secondary })}
				{...accessibility}
				style={({ pressed }) => [
					styles.row,
					{ flex: 1 },
					pressed && onPress ? { backgroundColor: tokens.surface2 } : null,
				]}
			>
				{leading ? (
					<SymbolView
						name={leading.symbol}
						size={22}
						tintColor={tokens.accentInk}
						style={styles.symbol}
					/>
				) : null}
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

	if (!actions || actions.length === 0) return body();
	return (
		<SwipeableRow actions={actions} menuTitle={title} closeMenuLabel="Close">
			{body}
		</SwipeableRow>
	);
}

const styles = StyleSheet.create({
	list: { gap: spacing.sm },
	header: {
		letterSpacing: 0.4,
		paddingHorizontal: metrics.formGutter,
	},
	footer: { paddingHorizontal: metrics.formGutter },
	group: {
		borderRadius: radius.contentCard,
		borderCurve: "continuous",
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
