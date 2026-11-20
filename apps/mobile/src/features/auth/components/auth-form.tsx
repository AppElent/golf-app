/**
 * `AuthInput` takes `ref` as a plain prop (React 19), so a screen can move
 * focus from one field to the next on "return".
 */
import {
	createContext,
	type ReactNode,
	type Ref,
	useCallback,
	useContext,
	useRef,
} from "react";
import {
	Keyboard,
	Pressable,
	ScrollView,
	type ScrollViewInstance,
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
	type as typeRamp,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { PrimaryButton } from "../../../ui/button";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";

/** Clear space kept between a focused field and the keyboard's top edge. */
const KEYBOARD_MARGIN = spacing.md;

/** Lets a field ask the screen to scroll it clear of the keyboard. */
const RevealContext = createContext<
	((input: TextInputInstance | null) => void) | null
>(null);

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
	const scroll = useRef<ScrollViewInstance>(null);
	const offset = useRef(0);
	// `automaticallyAdjustKeyboardInsets` scrolls a focused field only until its
	// bottom edge meets the keyboard, which on a small phone leaves it flush
	// against (and behind the rounded top of) the keyboard. Once the keyboard
	// has settled, scroll the rest of the way to leave a margin.
	const reveal = useCallback((input: TextInputInstance | null) => {
		const place = (keyboardTop: number) =>
			input?.measureInWindow((_x, y, _width, height) => {
				const hidden = y + height + KEYBOARD_MARGIN - keyboardTop;
				if (hidden > 0)
					scroll.current?.scrollTo({ y: offset.current + hidden });
			});
		const shown = Keyboard.metrics();
		if (shown) {
			setTimeout(() => place(shown.screenY), 250);
			return;
		}
		const subscription = Keyboard.addListener("keyboardDidShow", (event) => {
			subscription.remove();
			place(event.endCoordinates.screenY);
		});
	}, []);
	return (
		<Screen>
			{/* Scrolls so the links under the form stay reachable above the
			    keyboard; dragging the form down dismisses it. */}
			<ScrollView
				ref={scroll}
				onScroll={(event) => {
					offset.current = event.nativeEvent.contentOffset.y;
				}}
				scrollEventThrottle={16}
				contentContainerStyle={styles.root}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				automaticallyAdjustKeyboardInsets
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.brand}>
					<View style={styles.mark} />
					<AppText variant="display" accessibilityRole="header">
						{title}
					</AppText>
					{subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
				</View>
				<RevealContext value={reveal}>{children}</RevealContext>
				{footer ? <View style={styles.footer}>{footer}</View> : null}
			</ScrollView>
		</Screen>
	);
}

export function AuthInput({
	ref,
	...rest
}: TextInputProps & { ref?: Ref<TextInputInstance> }) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const reveal = useContext(RevealContext);
	const own = useRef<TextInputInstance | null>(null);
	return (
		<TextInput
			ref={(node) => {
				own.current = node;
				if (typeof ref === "function") ref(node);
				else if (ref) ref.current = node;
			}}
			// A read-only field (the account name above a new password) reads
			// as information, not as something to fill in.
			style={[styles.input, rest.editable === false && styles.readOnly]}
			placeholderTextColor={colors.textFaint}
			accessibilityLabel={rest.accessibilityLabel ?? rest.placeholder}
			{...rest}
			onFocus={(event) => {
				rest.onFocus?.(event);
				reveal?.(own.current);
			}}
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
			flexGrow: 1,
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
			fontSize: typeRamp.control.fontSize,
			color: colors.text,
		},
		readOnly: { color: colors.textMuted, backgroundColor: colors.bg },
		disabled: { opacity: 0.5 },
		footer: { marginTop: spacing.md, alignItems: "center", gap: spacing.sm },
		linkRow: {
			flexDirection: "row",
			flexWrap: "wrap",
			justifyContent: "center",
			gap: spacing.xs,
		},
	});
