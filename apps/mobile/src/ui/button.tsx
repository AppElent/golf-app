/**
 * Two buttons, because V1 needs two: the accent-filled primary action and a
 * quiet bordered one. Both are capsules — the web's `--r-pill` on its primary
 * CTA, and the shape a thumb finds without looking.
 *
 * `Pressable`'s `pressed` state carries the feedback rather than an opacity
 * animation: on a phone held at arm's length mid-set, a colour change reads
 * and a fade does not.
 */
import {
	ActivityIndicator,
	Pressable,
	type PressableProps,
	StyleSheet,
	View,
} from "react-native";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { AppText } from "./text";

type Props = Omit<PressableProps, "children"> & {
	label: string;
	/** Rendered to the left of the label — an icon, usually. */
	icon?: React.ReactNode;
	size?: "md" | "lg";
	loading?: boolean;
};

export function PrimaryButton({
	label,
	icon,
	size = "md",
	loading = false,
	style,
	disabled,
	...rest
}: Props) {
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
			style={(state) => [
				styles.base,
				size === "lg" && styles.lg,
				{
					backgroundColor:
						disabled && !loading
							? colors.surface2
							: state.pressed
								? colors.accentPressed
								: colors.accentFill,
				},
				typeof style === "function" ? style(state) : style,
			]}
		>
			{loading ? (
				<ActivityIndicator color={colors.onAccent} />
			) : icon ? (
				<View style={styles.icon}>{icon}</View>
			) : null}
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
	icon,
	size = "md",
	loading = false,
	style,
	disabled,
	...rest
}: Props) {
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
			style={(state) => [
				styles.base,
				size === "lg" && styles.lg,
				styles.ghost,
				state.pressed && { backgroundColor: colors.surface2 },
				typeof style === "function" ? style(state) : style,
			]}
		>
			{loading ? (
				<ActivityIndicator color={colors.text} />
			) : icon ? (
				<View style={styles.icon}>{icon}</View>
			) : null}
			<AppText
				variant={size === "lg" ? "heading" : "body"}
				style={{
					color: disabled && !loading ? colors.textMuted : colors.text,
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
		icon: {
			alignItems: "center",
			justifyContent: "center",
		},
	});
