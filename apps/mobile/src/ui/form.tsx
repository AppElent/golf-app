import { HeaderHeightContext } from "expo-router/react-navigation";
import { SymbolView } from "expo-symbols";
import {
	Children,
	type ComponentProps,
	type ReactNode,
	type Ref,
	useContext,
} from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	type ScrollViewInstance,
	StyleSheet,
	TextInput,
	type TextInputInstance,
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
import { Segmented, type SegmentedOption } from "./segmented";
import { AppText } from "./text";

type PrimaryAction = {
	label: string;
	accessibilityLabel?: string;
	onPress: () => void;
	loading?: boolean;
	disabled?: boolean;
};

/**
 * Owns the mechanics every long mobile form otherwise reimplements: keyboard
 * avoidance, safe-area footer, one scrolling content column and one primary
 * action. Route-backed screens leave `title` undefined and use the navigator.
 */
export function FormScreen({
	children,
	title,
	showHeader = title !== undefined,
	cancelLabel = "Cancel",
	onCancel,
	primaryAction,
	primaryActionPlacement = "fixed",
	contentStyle,
	scrollRef,
	nativeSheet = false,
	avoidKeyboard = true,
}: {
	children: ReactNode;
	title?: string;
	showHeader?: boolean;
	cancelLabel?: string;
	onCancel?: () => void;
	primaryAction?: PrimaryAction;
	primaryActionPlacement?: "fixed" | "header";
	contentStyle?: ViewStyle;
	scrollRef?: Ref<ScrollViewInstance>;
	/** Keep the scroll view at the native sheet root so UIKit owns its gestures. */
	nativeSheet?: boolean;
	/**
	 * Wrap the content in a `KeyboardAvoidingView`. Tab-root screens with no
	 * inputs turn this off so the `ScrollView` is the screen's first native
	 * child, which is what lets UIKit collapse the large title on scroll.
	 */
	avoidKeyboard?: boolean;
}) {
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const headerHeight = useContext(HeaderHeightContext) ?? 0;

	const content = (
		<>
			{showHeader ? (
				<View style={styles.modalHeader}>
					{onCancel ? (
						<Pressable
							onPress={onCancel}
							accessibilityRole="button"
							style={styles.headerAction}
						>
							<AppText style={styles.headerCancelText}>{cancelLabel}</AppText>
						</Pressable>
					) : (
						<View style={styles.headerAction} />
					)}
					{title ? (
						<AppText
							variant="heading"
							numberOfLines={2}
							style={styles.modalTitle}
						>
							{title}
						</AppText>
					) : (
						<View style={styles.modalTitle} />
					)}
					{primaryAction && primaryActionPlacement === "header" ? (
						<Pressable
							onPress={primaryAction.onPress}
							disabled={primaryAction.disabled || primaryAction.loading}
							accessibilityRole="button"
							accessibilityLabel={primaryAction.accessibilityLabel}
							accessibilityState={{
								disabled: primaryAction.disabled || primaryAction.loading,
								busy: primaryAction.loading,
							}}
							style={[styles.headerAction, styles.headerActionTrailing]}
						>
							<AppText style={styles.headerActionText}>
								{primaryAction.label}
							</AppText>
						</Pressable>
					) : (
						<View style={styles.headerAction} />
					)}
				</View>
			) : null}
			<ScrollView
				ref={scrollRef}
				style={nativeSheet ? styles.screen : undefined}
				automaticallyAdjustKeyboardInsets={nativeSheet}
				scrollToOverflowEnabled={nativeSheet}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={[styles.content, contentStyle]}
			>
				{children}
			</ScrollView>
			{primaryAction && primaryActionPlacement === "fixed" ? (
				<View
					style={[
						styles.footer,
						{ paddingBottom: Math.max(insets.bottom, spacing.sm) },
					]}
				>
					<PrimaryButton
						label={primaryAction.label}
						accessibilityLabel={primaryAction.accessibilityLabel}
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
			keyboardVerticalOffset={showHeader ? 0 : headerHeight}
			style={styles.screen}
		>
			{content}
		</KeyboardAvoidingView>
	);
}

/** A grouped mobile section with a title outside and row separators inside. */
export function FormSection({
	separatorInset,
	title,
	footer,
	children,
	style,
}: {
	title?: string;
	footer?: string;
	children: ReactNode;
	style?: ViewStyle;
	separatorInset?: number;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={[styles.section, style]}>
			{title ? <AppText variant="label">{title}</AppText> : null}
			<View style={styles.group}>
				{Children.map(children, (row, index) => (
					<>
						{index > 0 ? (
							<View
								style={[
									styles.separator,
									separatorInset === undefined
										? undefined
										: { marginLeft: separatorInset },
								]}
							/>
						) : null}
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
	style?: TextInputProps["style"];
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
				placeholderTextColor={props.placeholderTextColor ?? colors.textFaint}
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
	accessory,
	inputStyle,
	inputRef,
	...props
}: TextInputProps & {
	label: string;
	suffix: string;
	accessory?: ReactNode;
	inputStyle?: TextInputProps["style"];
	inputRef?: Ref<TextInputInstance>;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.inlineRow}>
			<AppText style={styles.rowLabel}>{label}</AppText>
			<View style={styles.inlineControls}>
				<TextInput
					ref={inputRef}
					{...props}
					accessibilityLabel={props.accessibilityLabel ?? label}
					placeholderTextColor={props.placeholderTextColor ?? colors.textFaint}
					style={[styles.numberInput, inputStyle]}
				/>
				<AppText variant="caption" style={styles.suffix}>
					{suffix}
				</AppText>
				{accessory}
			</View>
		</View>
	);
}

const TILE_COLORS = {
	indigo: "tileIndigo",
	blue: "tileBlue",
	orange: "tileOrange",
	green: "tileGreen",
	purple: "tilePurple",
	teal: "tileTeal",
} as const;

export function DisclosureRow({
	label,
	value,
	expanded,
	accessibilityLabel,
	onPress,
	icon,
	disabled = false,
	destructive = false,
}: {
	label: string;
	value?: string;
	expanded?: boolean;
	accessibilityLabel?: string;
	onPress?: () => void;
	/** iOS draws a settings tile; Android shows the plain icon, as Material does. */
	icon?: {
		name: ComponentProps<typeof SymbolView>["name"];
		tile: "indigo" | "blue" | "orange" | "green" | "purple" | "teal";
	};
	disabled?: boolean;
	destructive?: boolean;
}) {
	const styles = useThemedStyles(createStyles);
	const colors = useTokens();
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityValue={value ? { text: value } : undefined}
			accessibilityState={{
				disabled,
				...(expanded === undefined ? {} : { expanded }),
			}}
			style={({ pressed }) => [styles.actionRow, pressed && styles.pressedRow]}
		>
			{icon ? (
				<View
					style={{
						width: 30,
						height: 30,
						borderRadius: 7,
						borderCurve: "continuous",
						backgroundColor:
							Platform.OS === "ios"
								? colors[TILE_COLORS[icon.tile]]
								: undefined,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<SymbolView
						name={icon.name}
						tintColor={Platform.OS === "ios" ? "#ffffff" : colors.textMuted}
						size={Platform.OS === "ios" ? 18 : 22}
					/>
				</View>
			) : null}
			<AppText
				style={[
					styles.rowLabel,
					destructive ? { color: colors.danger } : undefined,
				]}
			>
				{label}
			</AppText>
			{value ? <AppText variant="caption">{value}</AppText> : null}
			<AppText style={styles.disclosureGlyph}>
				{expanded === undefined ? "›" : expanded ? "−" : "+"}
			</AppText>
		</Pressable>
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
	tone = "accent",
	onPress,
	disabled,
}: {
	label: string;
	tone?: "accent" | "destructive" | "neutral";
	onPress: () => void;
	disabled?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const color =
		tone === "destructive"
			? colors.danger
			: tone === "neutral"
				? colors.text
				: colors.accent;
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			style={({ pressed }) => [
				styles.textAction,
				pressed && styles.pressedRow,
				disabled && styles.disabled,
			]}
		>
			<AppText style={[styles.textActionLabel, { color }]}>{label}</AppText>
		</Pressable>
	);
}

export function StepperField({
	label,
	value,
	step = 1,
	min = 0,
	onChange,
}: {
	label: string;
	value: number;
	step?: number;
	min?: number;
	onChange: (value: number) => void;
}) {
	const styles = useThemedStyles(createStyles);
	const { t } = useI18n();
	const round = (number: number) => Math.round(number * 10) / 10;
	return (
		<View style={styles.stepperField}>
			<Pressable
				onPress={() => onChange(round(Math.max(min, value - step)))}
				accessibilityRole="button"
				accessibilityLabel={fmt(t.common.decrease, { label })}
				style={styles.stepperButton}
			>
				<AppText style={styles.stepperGlyph}>−</AppText>
			</Pressable>
			<View style={styles.stepperValue}>
				<AppText style={styles.tabularValue}>{value}</AppText>
				<AppText variant="caption">{label}</AppText>
			</View>
			<Pressable
				onPress={() => onChange(round(value + step))}
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
		modalHeader: {
			minHeight: 52,
			paddingHorizontal: spacing.sm,
			flexDirection: "row",
			alignItems: "center",
		},
		headerAction: {
			minWidth: 76,
			minHeight: metrics.hitTarget,
			paddingHorizontal: spacing.sm,
			alignItems: "flex-start",
			justifyContent: "center",
		},
		headerCancelText: { color: colors.textMuted, fontWeight: "500" },
		headerActionText: { color: colors.accent, fontWeight: "700" },
		headerActionTrailing: { alignItems: "flex-end" },
		modalTitle: { flex: 1, textAlign: "center" },
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
		suffix: { width: 30 },
		actionRow: {
			minHeight: metrics.rowMinHeight,
			paddingHorizontal: spacing.md,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		pressedRow: { backgroundColor: colors.surface2 },
		disclosureGlyph: {
			minWidth: 20,
			textAlign: "center",
			color: colors.accent,
			fontSize: 22,
			fontWeight: "700",
		},
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
		textActionLabel: { fontWeight: "700" },
		disabled: { opacity: 0.5 },
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

/** A multi-select choice inside a grouped form section. */
export function FormChoiceRow({
	label,
	selected,
	onPress,
	leading,
	secondary,
	disabled = false,
	role = "checkbox",
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
	leading?: ReactNode;
	secondary?: string;
	disabled?: boolean;
	role?: "checkbox" | "radio";
}) {
	const colors = useTokens();
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole={role}
			accessibilityLabel={label}
			accessibilityState={{ checked: selected, disabled }}
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

/** Compact search field with a persistent accessible name and native clear control. */
export function FormSearchField({
	label,
	...props
}: TextInputProps & { label: string }) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				paddingHorizontal: spacing.sm,
				gap: spacing.sm,
				minHeight: 44,
			}}
		>
			<SymbolView
				name={{ ios: "magnifyingglass", android: "search", web: "search" }}
				size={18}
				tintColor={colors.textMuted}
			/>
			<TextInput
				{...props}
				accessibilityLabel={label}
				placeholder={label}
				placeholderTextColor={colors.textFaint}
				style={[styles.textInput, { flex: 1, minHeight: 44 }]}
				autoCorrect={false}
				clearButtonMode="while-editing"
				returnKeyType="search"
			/>
		</View>
	);
}
