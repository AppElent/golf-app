import { SymbolView } from "expo-symbols";
import { Children, type ReactNode, type Ref, useRef, useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	TextInput,
	type TextInputInstance,
	type TextInputProps,
	View,
	type ViewInstance,
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
	// How far below the top of the window this form starts. A navigator header
	// that pushes the content down counts; a transparent one the content slides
	// under does not, so it is measured instead of read from the header height.
	const frame = useRef<ViewInstance>(null);
	const [windowTop, setWindowTop] = useState(0);
	const measureTop = () =>
		frame.current?.measureInWindow((_x, y) => setWindowTop(y));

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
		<View ref={frame} onLayout={measureTop} style={styles.screen}>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				keyboardVerticalOffset={windowTop}
				style={styles.screen}
			>
				{content}
			</KeyboardAvoidingView>
		</View>
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
	ref,
	label,
	error,
	appearance = "inset",
	style,
	...props
}: TextInputProps & {
	/** React 19 plain prop, so a form can move focus to the next field. */
	ref?: Ref<TextInputInstance>;
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
				ref={ref}
				{...props}
				accessibilityLabel={props.accessibilityLabel ?? label}
				placeholderTextColor={colors.textFaint}
				style={[
					styles.textInput,
					appearance === "plain" && styles.plainInput,
					// Read-only (the account name above a new password): information,
					// not a field to fill in.
					props.editable === false && styles.readOnlyInput,
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

/** An on/off setting as one grouped form row: the label, then a native switch. */
export function FormSwitchRow({
	label,
	value,
	onValueChange,
	disabled,
}: {
	label: string;
	value: boolean;
	onValueChange: (next: boolean) => void;
	disabled?: boolean;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.inlineRow}>
			<AppText style={styles.rowLabel}>{label}</AppText>
			<Switch
				value={value}
				onValueChange={onValueChange}
				disabled={disabled}
				accessibilityLabel={label}
			/>
		</View>
	);
}

/** A text field on one line with its label; the value sits at the trailing edge. */
export function FormInlineTextRow({
	label,
	...props
}: TextInputProps & { label: string }) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.inlineRow}>
			<AppText variant="row" style={styles.inlineLabel}>
				{label}
			</AppText>
			<TextInput
				{...props}
				accessibilityLabel={props.accessibilityLabel ?? label}
				placeholderTextColor={colors.textFaint}
				style={[
					styles.inlineInput,
					props.editable === false && { color: colors.textMuted },
				]}
			/>
		</View>
	);
}

export function TextAction({
	label,
	onPress,
	destructive = false,
}: {
	label: string;
	onPress: () => void;
	destructive?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			style={({ pressed }) => [styles.textAction, pressed && styles.pressedRow]}
		>
			<AppText
				style={[
					styles.textActionLabel,
					destructive && { color: colors.danger },
				]}
			>
				{label}
			</AppText>
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
		readOnlyInput: { color: colors.textMuted, backgroundColor: "transparent" },
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
		inlineLabel: { fontWeight: "400" },
		inlineInput: {
			flex: 1,
			minHeight: metrics.hitTarget,
			color: colors.text,
			fontSize: 17,
			fontVariant: ["tabular-nums"],
			textAlign: "right",
		},
		pressedRow: { backgroundColor: colors.surface2 },
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
			accessibilityLabel={secondary ? `${label}, ${secondary}` : label}
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
