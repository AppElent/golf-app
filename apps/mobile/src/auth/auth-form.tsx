/**
 * The pieces every signed-out screen is built from: the brand header, a
 * field, the error line, the submit, and the "go to the other screen" link.
 *
 * Sign-in, sign-up and email verification share one look so that moving
 * between them reads as one flow. Third-party providers (Apple, Google, …)
 * slot in through `AuthScreen`'s `children` between the submit and the
 * footer — see `SocialButtons`.
 *
 * `AuthInput` takes `ref` as a plain prop (React 19), so a screen can move
 * focus from one field to the next on "return".
 */
import type { ReactNode, Ref } from "react";
import {
	Pressable,
	StyleSheet,
	TextInput,
	type TextInputInstance,
	type TextInputProps,
	View,
} from "react-native";

import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { PrimaryButton } from "../ui/button";
import { Screen } from "../ui/screen";
import { AppText } from "../ui/text";

export function AuthScreen({
	title,
	subtitle,
	footer,
	children,
}: {
	title: string;
	subtitle?: string;
	footer?: ReactNode;
	children: ReactNode;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<Screen>
			<View style={styles.root}>
				<View style={styles.brand}>
					<View style={styles.mark} />
					<AppText variant="display" accessibilityRole="header">
						{title}
					</AppText>
					{subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
				</View>
				{children}
				{footer ? <View style={styles.footer}>{footer}</View> : null}
			</View>
		</Screen>
	);
}

export function AuthInput({
	ref,
	...rest
}: TextInputProps & { ref?: Ref<TextInputInstance> }) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<TextInput
			ref={ref}
			style={styles.input}
			placeholderTextColor={colors.textFaint}
			accessibilityLabel={rest.accessibilityLabel ?? rest.placeholder}
			{...rest}
		/>
	);
}

export function AuthMessage({
	message,
	tone = "danger",
}: {
	message: string | null;
	tone?: "danger" | "muted";
}) {
	const colors = useTokens();
	if (!message) return null;
	return (
		<AppText
			variant="caption"
			accessibilityLiveRegion="polite"
			style={tone === "danger" ? { color: colors.danger } : undefined}
		>
			{message}
		</AppText>
	);
}

export function AuthSubmit({
	label,
	busy,
	disabled,
	onPress,
	testID,
}: {
	label: string;
	busy: boolean;
	disabled: boolean;
	onPress: () => void;
	testID?: string;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<PrimaryButton
			label={label}
			loading={busy}
			disabled={disabled}
			style={disabled && !busy && styles.disabled}
			onPress={onPress}
			testID={testID}
		/>
	);
}

/** "No account? Create one" — the prompt is plain, only the label is pressable. */
export function AuthLink({
	prompt,
	label,
	onPress,
	disabled = false,
}: {
	prompt?: string;
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.linkRow}>
			{prompt ? <AppText variant="caption">{prompt}</AppText> : null}
			<Pressable
				accessibilityRole="link"
				accessibilityState={{ disabled }}
				disabled={disabled}
				onPress={onPress}
				hitSlop={spacing.sm}
			>
				<AppText
					variant="caption"
					style={{ color: disabled ? colors.textMuted : colors.accent }}
				>
					{label}
				</AppText>
			</Pressable>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: {
			flex: 1,
			justifyContent: "center",
			paddingHorizontal: spacing.lg,
			gap: spacing.sm,
		},
		brand: { gap: spacing.xs, marginBottom: spacing.lg },
		mark: {
			width: 40,
			height: 40,
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
			marginBottom: spacing.sm,
		},
		input: {
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
			paddingHorizontal: spacing.md,
			paddingVertical: 14,
			fontSize: 16,
			color: colors.text,
		},
		disabled: { opacity: 0.5 },
		footer: { marginTop: spacing.md, alignItems: "center", gap: spacing.sm },
		linkRow: {
			flexDirection: "row",
			flexWrap: "wrap",
			justifyContent: "center",
			gap: spacing.xs,
		},
	});
