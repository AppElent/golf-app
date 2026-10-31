/**
 * `useConfirm()` — the phone's counterpart to the web's `useConfirm` in
 * `src/components/ui/confirm-dialog.tsx`, and the only way a destructive action
 * is allowed to ask.
 *
 * iOS uses a system alert; the shared promise API keeps destructive actions
 * consistent across screens. Other platforms retain their existing presentation.
 *
 * The API is a promise, so a caller reads top to bottom:
 *
 *     if (!(await confirm({ title: "Cancel this workout?", confirmLabel: "Cancel workout" }))) return;
 *
 * Confirm labels are verbs, never "OK" — a button that says what it does is the
 * difference between a considered answer and a reflex.
 */
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	Alert,
	Modal,
	Platform,
	Pressable,
	StyleSheet,
	View,
} from "react-native";
import { haptics } from "../feedback/haptics";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { useI18n } from "../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { AppText } from "./text";

export type ConfirmOptions = {
	title: string;
	/** One line of consequence. Say what happens, not "Are you sure?". */
	message?: string;
	/** A verb: "Delete workout", "Cancel workout". Never "OK". */
	confirmLabel: string;
	cancelLabel?: string;
	/** Paints the confirm button red. On for anything that destroys data. */
	destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
	const colors = useTokens();
	const { t } = useI18n();
	const styles = useThemedStyles(createStyles);
	const [options, setOptions] = useState<ConfirmOptions | null>(null);
	const reduceMotion = useReduceMotion();
	// Held across renders so the promise opened in `confirm` is the one settled
	// by the buttons. State would re-create it and strand the caller.
	const resolveRef = useRef<((answer: boolean) => void) | null>(null);

	const confirm = useCallback<ConfirmFn>((next) => {
		// The one place a destructive warning is played. Putting it here rather
		// than at each delete button is what keeps the vocabulary restrained:
		// every destructive confirmation warns exactly once, and no ordinary
		// confirmation can acquire a buzz by being copied from a destructive one.
		if (resolveRef.current) return Promise.resolve(false);
		if (next.destructive) haptics.destructiveWarning();
		return new Promise<boolean>((resolve) => {
			resolveRef.current = resolve;
			if (Platform.OS === "ios") {
				const finish = (answer: boolean) => {
					if (resolveRef.current !== resolve) return;
					resolveRef.current = null;
					resolve(answer);
				};
				Alert.alert(
					next.title,
					next.message,
					[
						{
							text: next.cancelLabel ?? "Keep",
							style: "cancel",
							onPress: () => finish(false),
						},
						{
							text: next.confirmLabel,
							style: next.destructive ? "destructive" : "default",
							onPress: () => finish(true),
						},
					],
					{ cancelable: true, onDismiss: () => finish(false) },
				);
			} else {
				setOptions(next);
			}
		});
	}, []);

	useEffect(
		() => () => {
			resolveRef.current?.(false);
			resolveRef.current = null;
		},
		[],
	);

	const settle = useCallback((answer: boolean) => {
		setOptions(null);
		resolveRef.current?.(answer);
		resolveRef.current = null;
	}, []);

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			<Modal
				visible={options !== null}
				transparent
				animationType={modalAnimation(reduceMotion, "fade")}
				// Android's back button must answer "no", not leave the promise
				// pending forever behind a dismissed dialog.
				onRequestClose={() => settle(false)}
			>
				<Pressable style={styles.backdrop} onPress={() => settle(false)}>
					{/* Swallows taps so pressing the card itself doesn't dismiss it. */}
					<Pressable style={styles.card} onPress={() => {}}>
						<AppText variant="heading">{options?.title}</AppText>
						{options?.message ? (
							<AppText variant="caption">{options.message}</AppText>
						) : null}

						<View style={styles.actions}>
							<Pressable
								accessibilityRole="button"
								onPress={() => settle(false)}
								style={({ pressed }) => [
									styles.button,
									styles.cancel,
									pressed && { backgroundColor: colors.surface2 },
								]}
							>
								<AppText variant="body">
									{options?.cancelLabel ?? t.common.keep}
								</AppText>
							</Pressable>

							<Pressable
								accessibilityRole="button"
								onPress={() => settle(true)}
								style={({ pressed }) => [
									styles.button,
									{
										backgroundColor: options?.destructive
											? colors.danger
											: colors.accentFill,
										opacity: pressed ? 0.85 : 1,
									},
								]}
							>
								<AppText
									variant="body"
									style={{
										fontWeight: "800",
										color: options?.destructive
											? colors.onDanger
											: colors.onAccent,
									}}
								>
									{options?.confirmLabel}
								</AppText>
							</Pressable>
						</View>
					</Pressable>
				</Pressable>
			</Modal>
		</ConfirmContext.Provider>
	);
}

export function useConfirm() {
	const confirm = useContext(ConfirmContext);
	if (!confirm) {
		throw new Error("useConfirm must be used inside <ConfirmProvider>");
	}
	return confirm;
}

/**
 * Convex throws `Error: <message>\n    at handler ...` — the server's message
 * with a stack welded on. Screens surface the first line, which is the part a
 * human wrote (e.g. "A session is already active.").
 */
export function convexErrorMessage(error: unknown, fallback: string) {
	if (!(error instanceof Error)) return fallback;
	const [firstLine] = error.message.split("\n");
	const cleaned = firstLine.replace(/^\[.*?\]\s*/, "").trim();
	return cleaned.length > 0 ? cleaned : fallback;
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		backdrop: {
			flex: 1,
			backgroundColor: colors.scrim,
			alignItems: "center",
			justifyContent: "center",
			padding: spacing.lg,
		},
		card: {
			width: "100%",
			maxWidth: 380,
			gap: spacing.sm,
			backgroundColor: colors.surface,
			borderColor: colors.border,
			borderWidth: 1,
			borderRadius: radius.sheet,
			padding: spacing.lg,
		},
		actions: {
			flexDirection: "row",
			gap: spacing.sm,
			marginTop: spacing.sm,
		},
		button: {
			flex: 1,
			minHeight: 44,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.pill,
			paddingHorizontal: spacing.md,
		},
		cancel: {
			backgroundColor: "transparent",
			borderWidth: 1,
			borderColor: colors.borderStrong,
		},
	});
