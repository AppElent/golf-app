import {
	ActivityIndicator,
	Pressable,
	type PressableProps,
	type StyleProp,
	StyleSheet,
	type ViewStyle,
} from "react-native";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { AppText } from "./text";

type Props = Omit<PressableProps, "children" | "style"> & {
	label: string;
	loading?: boolean;
	style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
	label,
	size = "md",
	loading = false,
	style,
	disabled,
	...rest
}: Props & { size?: "md" | "lg" }) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			{...rest}
			accessibilityRole={rest.accessibilityRole ?? "button"}
			accessibilityLabel={rest.accessibilityLabel ?? label}
			disabled={disabled || loading}
			accessibilityState={{
				...rest.accessibilityState,
				busy: loading,
				disabled: disabled || loading,
			}}
			style={({ pressed }) => [
				styles.base,
				size === "lg" && styles.lg,
				{
					backgroundColor:
						disabled && !loading
							? colors.surface2
							: pressed
								? colors.accentPressed
								: colors.accentFill,
				},
				style,
			]}
		>
			{loading ? <ActivityIndicator color={colors.onAccent} /> : null}
			<AppText
				variant={size === "lg" ? "heading" : "body"}
				style={{
					color: disabled && !loading ? colors.textMuted : colors.onAccent,
					fontWeight: "800",
					flexShrink: 1,
					textAlign: "center",
				}}
			>
				{label}
			</AppText>
		</Pressable>
	);
}

export function GhostButton({
	label,
	loading = false,
	tone = "neutral",
	style,
	disabled,
	...rest
}: Props & {
	/** "danger" for a destructive action that still needs a confirm step. */
	tone?: "neutral" | "danger";
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			{...rest}
			accessibilityRole={rest.accessibilityRole ?? "button"}
			accessibilityLabel={rest.accessibilityLabel ?? label}
			disabled={disabled || loading}
			accessibilityState={{
				...rest.accessibilityState,
				busy: loading,
				disabled: disabled || loading,
			}}
			style={({ pressed }) => [
				styles.base,
				styles.ghost,
				pressed && { backgroundColor: colors.surface2 },
				style,
			]}
		>
			{loading ? <ActivityIndicator color={colors.text} /> : null}
			<AppText
				variant="body"
				style={{
					color:
						disabled && !loading
							? colors.textMuted
							: tone === "danger"
								? colors.danger
								: colors.text,
					flexShrink: 1,
					textAlign: "center",
				}}
			>
				{label}
			</AppText>
		</Pressable>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		base: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.sm,
			borderRadius: radius.pill,
			paddingVertical: 14,
			paddingHorizontal: spacing.lg,
		},
		lg: {
			paddingVertical: 20,
			paddingHorizontal: spacing.xl,
		},
		ghost: {
			backgroundColor: "transparent",
			borderWidth: 1,
			borderColor: colors.borderStrong,
		},
	});
