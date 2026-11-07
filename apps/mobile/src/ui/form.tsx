import { HeaderHeightContext } from "expo-router/react-navigation";
import { SymbolView } from "expo-symbols";
import { Children, type ReactNode, useContext } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	type TextInputProps,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, useI18n } from "../i18n";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { PrimaryButton } from "./button";
import { Segmented } from "./segmented";
import type { SegmentedOption } from "./segmented.shared";
import { AppText } from "./text";

type PrimaryAction = {
	label: string;
	onPress: () => void;
	loading?: boolean;
	disabled?: boolean;
};

/**
 * Owns the mechanics every long mobile form otherwise reimplements: keyboard
 * avoidance, safe-area footer, one scrolling content column and one primary
 * action. Route-backed screens use the navigator's header; a screen presented
 * without one passes its own as `header`, above the scrolling content.
 */
export function FormScreen({
	children,
	header,
	primaryAction,
	nativeSheet = false,
	avoidKeyboard = true,
}: {
	children: ReactNode;
	header?: ReactNode;
	primaryAction?: PrimaryAction;
	/** Keep the scroll view at the native sheet root so UIKit owns its gestures. */
	nativeSheet?: boolean;
	/**
	 * Wrap the content in a `KeyboardAvoidingView`. A screen with no inputs can
	 * turn this off: there is nothing for the keyboard to cover.
	 */
	avoidKeyboard?: boolean;
}) {
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const headerHeight = useContext(HeaderHeightContext) ?? 0;

	const content = (
		<>
			{header}
			<ScrollView
				style={nativeSheet ? styles.screen : undefined}
				automaticallyAdjustKeyboardInsets={nativeSheet}
				scrollToOverflowEnabled={nativeSheet}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.content}
			>
				{children}
			</ScrollView>
			{primaryAction ? (
				<View
					style={[
						styles.footer,
						{ paddingBottom: Math.max(insets.bottom, spacing.sm) },
					]}
				>
					<PrimaryButton
						label={primaryAction.label}
						onPress={primaryAction.onPress}
						loading={primaryAction.loading}
						disabled={primaryAction.disabled}
					/>
				</View>
			) : null}
		</>
	);
	if (nativeSheet) return content;
	if (!avoidKeyboard) return <View style={styles.screen}>{content}</View>;
	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			keyboardVerticalOffset={header ? 0 : headerHeight}
			style={styles.screen}
		>
			{content}
		</KeyboardAvoidingView>
	);
}

/** A grouped mobile section with a title outside and row separators inside. */
export function FormSection({
	title,
	footer,
	children,
}: {
	title?: string;
	footer?: string;
	children: ReactNode;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.section}>
			{title ? <AppText variant="label">{title}</AppText> : null}
			<View style={styles.group}>
				{Children.map(children, (row, index) => (
					<>
						{index > 0 ? <View style={styles.separator} /> : null}
						{row}
					</>
				))}
			</View>
			{footer ? <AppText variant="caption">{footer}</AppText> : null}
		</View>
	);
}

/** A grouped surface for composed content that should not receive row dividers. */
export function GroupedSurface({
	children,
	style,
}: {
	children: ReactNode;
	style?: ViewStyle;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={[styles.group, styles.surfacePadding, style]}>{children}</View>
	);
}

export function FormTextField({
	label,
	error,
	appearance = "inset",
	style,
	...props
}: TextInputProps & {
	label: string;
	error?: string;
	appearance?: "inset" | "plain";
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View
			style={[styles.fieldRow, appearance === "plain" && styles.plainField]}
		>
			<AppText variant="label">{label}</AppText>
			<TextInput
				{...props}
				accessibilityLabel={props.accessibilityLabel ?? label}
				placeholderTextColor={colors.textFaint}
				style={[
					styles.textInput,
					appearance === "plain" && styles.plainInput,
					style,
				]}
			/>
			{error ? (
				<AppText selectable accessibilityRole="alert" style={styles.error}>
					{error}
				</AppText>
			) : null}
		</View>
	);
}

/** A mutually exclusive choice set presented as one grouped form row. */
export function FormSegmentedRow<Value extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label?: string;
	options: readonly SegmentedOption<Value>[];
	value: Value;
	onChange: (next: Value) => void;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View
			style={
				label && Platform.OS === "ios" ? styles.inlineRow : styles.segmentedRow
			}
		>
			{label ? <AppText style={styles.rowLabel}>{label}</AppText> : null}
			<View style={label && Platform.OS === "ios" ? { flex: 1.2 } : undefined}>
				<Segmented options={options} value={value} onChange={onChange} />
			</View>
		</View>
	);
}

export function InlineNumberFieldRow({
	label,
	suffix,
	...props
}: TextInputProps & {
	label: string;
	suffix: string;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.inlineRow}>
			<AppText style={styles.rowLabel}>{label}</AppText>
			<View style={styles.inlineControls}>
				<TextInput
					{...props}
					accessibilityLabel={props.accessibilityLabel ?? label}
					placeholderTextColor={colors.textFaint}
					style={styles.numberInput}
				/>
				<AppText variant="caption" style={styles.suffix}>
					{suffix}
				</AppText>
			</View>
		</View>
	);
}

export function AddRow({
	label,
	onPress,
}: {
	label: string;
	onPress: () => void;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			style={({ pressed }) => [styles.actionRow, pressed && styles.pressedRow]}
		>
			<AppText style={styles.addGlyph}>＋</AppText>
			<AppText style={styles.actionLabel}>{label}</AppText>
		</Pressable>
	);
}

export function TextAction({
	label,
	onPress,
}: {
	label: string;
	onPress: () => void;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			style={({ pressed }) => [styles.textAction, pressed && styles.pressedRow]}
		>
			<AppText style={styles.textActionLabel}>{label}</AppText>
		</Pressable>
	);
}

export function StepperField({
	label,
	value,
	min = 0,
	startAt = min,
	onChange,
}: {
	label: string;
	/** null: not entered yet, shown as "–"; the first tap lands on `startAt`. */
	value: number | null;
	min?: number;
	startAt?: number;
	onChange: (value: number) => void;
}) {
	const styles = useThemedStyles(createStyles);
	const { t } = useI18n();
	return (
		<View style={styles.stepperField}>
			<Pressable
				onPress={() => onChange(Math.max(min, (value ?? startAt) - 1))}
				accessibilityRole="button"
				accessibilityLabel={fmt(t.common.decrease, { label })}
				style={styles.stepperButton}
			>
				<AppText style={styles.stepperGlyph}>−</AppText>
			</Pressable>
			<View style={styles.stepperValue}>
				<AppText style={styles.tabularValue}>{value ?? "–"}</AppText>
				<AppText variant="caption">{label}</AppText>
			</View>
			<Pressable
				onPress={() => onChange(value === null ? startAt : value + 1)}
				accessibilityRole="button"
				accessibilityLabel={fmt(t.common.increase, { label })}
				style={styles.stepperButton}
			>
				<AppText style={styles.stepperGlyph}>＋</AppText>
			</Pressable>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: colors.bg },
		content: {
			alignSelf: "center",
			width: "100%",
			maxWidth: 640,
			paddingHorizontal: metrics.screenGutter,
			paddingTop: spacing.sm,
			paddingBottom: spacing.xl,
			gap: metrics.sectionGap,
		},
		footer: {
			paddingTop: spacing.sm,
			paddingHorizontal: metrics.screenGutter,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border,
			backgroundColor: colors.bg,
		},
		section: { gap: spacing.sm },
		group: {
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		surfacePadding: { padding: spacing.md },
		separator: {
			height: StyleSheet.hairlineWidth,
			marginLeft: spacing.md,
			backgroundColor: colors.borderStrong,
		},
		plainField: { paddingVertical: spacing.sm, gap: 0 },
		plainInput: {
			backgroundColor: "transparent",
			paddingHorizontal: 0,
			fontSize: 17,
		},
		fieldRow: { padding: spacing.md, gap: spacing.sm },
		segmentedRow: { padding: spacing.md },
		textInput: {
			minHeight: metrics.fieldMinHeight,
			borderRadius: radius.md,
			borderCurve: "continuous",
			backgroundColor: colors.surface2,
			paddingHorizontal: spacing.md,
			color: colors.text,
			fontSize: 15,
		},
		error: { color: colors.danger },
		inlineRow: {
			minHeight: metrics.rowMinHeight,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.xs,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		rowLabel: { flex: 1, minWidth: 0 },
		inlineControls: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			flexShrink: 0,
		},
		numberInput: {
			width: 82,
			minHeight: metrics.hitTarget,
			borderRadius: radius.md,
			borderCurve: "continuous",
			backgroundColor: colors.surface2,
			paddingHorizontal: spacing.sm,
			color: colors.text,
			fontSize: 15,
			fontVariant: ["tabular-nums"],
			textAlign: "right",
		},
		suffix: { minWidth: 30 },
		actionRow: {
			minHeight: metrics.rowMinHeight,
			paddingHorizontal: spacing.md,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		pressedRow: { backgroundColor: colors.surface2 },
		addGlyph: { color: colors.accent, fontSize: 20, fontWeight: "700" },
		actionLabel: { flex: 1, color: colors.accent, fontWeight: "700" },
		textAction: {
			minHeight: metrics.hitTarget,
			paddingHorizontal: spacing.md,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.md,
			borderCurve: "continuous",
		},
		textActionLabel: { color: colors.text, fontWeight: "700" },
		stepperField: {
			flex: 1,
			minWidth: 96,
			height: 48,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			borderRadius: radius.md,
			borderCurve: "continuous",
			backgroundColor: colors.surface2,
		},
		stepperButton: {
			width: 36,
			height: metrics.hitTarget,
			alignItems: "center",
			justifyContent: "center",
		},
		stepperGlyph: { color: colors.textMuted, fontSize: 18, fontWeight: "800" },
		stepperValue: { alignItems: "center" },
		tabularValue: { fontWeight: "800", fontVariant: ["tabular-nums"] },
	});

/** A checkbox or radio choice inside a grouped form section. */
export function FormChoiceRow({
	label,
	selected,
	onPress,
	leading,
	secondary,
	role = "checkbox",
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
	leading?: ReactNode;
	secondary?: string;
	role?: "checkbox" | "radio";
}) {
	const colors = useTokens();
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole={role}
			accessibilityLabel={label}
			accessibilityState={{ checked: selected }}
			style={({ pressed }) => ({
				minHeight: 52,
				paddingHorizontal: spacing.md,
				paddingVertical: spacing.sm,
				flexDirection: "row",
				alignItems: "center",
				gap: spacing.sm,
				backgroundColor: pressed ? colors.surface2 : undefined,
			})}
		>
			{leading}
			<View style={{ flex: 1, gap: spacing.xs }}>
				<AppText variant="body">{label}</AppText>
				{secondary && <AppText variant="footnote">{secondary}</AppText>}
			</View>
			<View
				style={{
					width: 24,
					height: 24,
					borderRadius: 12,
					borderWidth: selected ? 0 : 1.5,
					borderColor: colors.textFaint,
					backgroundColor: selected ? colors.accentFill : undefined,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{selected ? (
					<AppText variant="label" style={{ color: colors.onAccent }}>
						✓
					</AppText>
				) : null}
			</View>
		</Pressable>
	);
}

export function FormSearchField({
	label,
	value,
	onChangeText,
}: {
	label: string;
	value: string;
	onChangeText: (text: string) => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				paddingHorizontal: spacing.sm,
				gap: spacing.sm,
				minHeight: metrics.fieldMinHeight,
			}}
		>
			<SymbolView
				name={{ ios: "magnifyingglass", android: "search", web: "search" }}
				size={18}
				tintColor={colors.textMuted}
			/>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				accessibilityLabel={label}
				placeholder={label}
				placeholderTextColor={colors.textFaint}
				style={[styles.textInput, { flex: 1 }]}
				autoCorrect={false}
				clearButtonMode="while-editing"
				returnKeyType="search"
			/>
		</View>
	);
}
