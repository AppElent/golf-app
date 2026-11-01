/**
 * `useToast()` — the phone's counterpart to the web's `src/components/ui/toast.tsx`.
 *
 * The rule this exists to enforce: a mutation that fails must say so. A tap
 * that appears to do nothing is the worst outcome available, and it is the
 * default one if nobody catches the throw.
 *
 * Success toasts are the exception, not the habit — only when the result isn't
 * already visible on screen. A logged set that appears in the table announces
 * itself; a cancelled session that vanishes does not need a receipt.
 */

import { SymbolView } from "expo-symbols";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { GlassSurface } from "./glass-surface";
import { AppText } from "./text";

type ToastKind = "error" | "success";

/** One follow-up, such as undo, for a change the person may not have meant. */
export type ToastAction = { label: string; onPress: () => void };
type ToastOptions = { action?: ToastAction };
type Toast = {
	id: number;
	kind: ToastKind;
	message: string;
	action?: ToastAction;
};

type ToastApi = {
	error: (message: string, options?: ToastOptions) => void;
	success: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Long enough to read a sentence, short enough not to sit in the way. */
const DISMISS_MS = 4000;
/** An action needs time to be found and reached, not just read. */
const ACTION_DISMISS_MS = 6000;
/**
 * A toast with an action sits low, in thumb reach above the bottom toolbar,
 * because it asks for a tap; a plain one stays at the top, out of the way.
 */
const BOTTOM_TOOLBAR_CLEARANCE = 72;
/**
 * The action toast appears over list rows, so a tap aimed at the row beneath
 * it (logging the next food, say) can land on Undo instead. Taps that arrive
 * before the toast has been on screen this long were aimed elsewhere.
 */
export const ACTION_ARM_MS = 700;

export function ToastProvider({ children }: { children: ReactNode }) {
	const styles = useThemedStyles(createStyles);
	const colors = useTokens();
	const [toast, setToast] = useState<Toast | null>(null);
	const [armedId, setArmedId] = useState<number | null>(null);
	const insets = useSafeAreaInsets();

	// Keyed on the toast's id so a second toast restarts the clock rather than
	// inheriting the remainder of the first one's.
	useEffect(() => {
		if (!toast) return;
		const timer = setTimeout(
			() => setToast(null),
			toast.action ? ACTION_DISMISS_MS : DISMISS_MS,
		);
		return () => clearTimeout(timer);
	}, [toast]);

	useEffect(() => {
		if (!toast?.action) return;
		const timer = setTimeout(() => setArmedId(toast.id), ACTION_ARM_MS);
		return () => clearTimeout(timer);
	}, [toast]);

	const api = useMemo<ToastApi>(() => {
		const push =
			(kind: ToastKind) => (message: string, options?: ToastOptions) =>
				setToast({ id: Date.now(), kind, message, action: options?.action });
		return { error: push("error"), success: push("success") };
	}, []);

	return (
		<ToastContext.Provider value={api}>
			{children}
			{toast ? (
				<View
					style={[
						styles.wrap,
						toast.action
							? { bottom: insets.bottom + BOTTOM_TOOLBAR_CLEARANCE }
							: { top: insets.top + spacing.sm },
					]}
					pointerEvents="box-none"
				>
					{toast.action ? (
						// Design `.toast`: a glass capsule above the bottom toolbar —
						// ✓, the message, and the action in the accent.
						<GlassSurface capsule style={styles.capsule}>
							<View
								accessible
								accessibilityRole="alert"
								accessibilityLiveRegion="assertive"
								style={styles.capsuleBody}
							>
								<SymbolView
									name={
										toast.kind === "error"
											? {
													ios: "exclamationmark.circle",
													android: "error",
													web: "error",
												}
											: { ios: "checkmark", android: "check", web: "check" }
									}
									size={17}
									weight="bold"
									tintColor={
										toast.kind === "error" ? colors.danger : colors.accentInk
									}
								/>
								<AppText
									variant="secondary"
									numberOfLines={2}
									style={[styles.text, styles.message]}
								>
									{toast.message}
								</AppText>
							</View>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={toast.action.label}
								hitSlop={8}
								onPress={() => {
									if (armedId !== toast.id) return;
									const action = toast.action;
									setToast(null);
									action?.onPress();
								}}
								style={styles.action}
							>
								<AppText variant="secondary" style={styles.actionText}>
									{toast.action.label}
								</AppText>
							</Pressable>
						</GlassSurface>
					) : (
						<Pressable
							accessibilityRole="alert"
							accessibilityLiveRegion="assertive"
							onPress={() => setToast(null)}
							style={[
								styles.toast,
								toast.kind === "error" ? styles.error : styles.success,
							]}
						>
							<AppText variant="body" style={styles.text}>
								{toast.message}
							</AppText>
						</Pressable>
					)}
				</View>
			) : null}
		</ToastContext.Provider>
	);
}

export function useToast() {
	const api = useContext(ToastContext);
	if (!api) throw new Error("useToast must be used inside <ToastProvider>");
	return api;
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		wrap: {
			position: "absolute",
			left: spacing.md,
			right: spacing.md,
			zIndex: 100,
		},
		toast: {
			borderRadius: radius.lg,
			borderWidth: 1,
			paddingVertical: spacing.sm + 2,
			paddingHorizontal: spacing.md,
		},
		error: {
			backgroundColor: colors.surface,
			borderColor: colors.danger,
		},
		success: {
			backgroundColor: colors.surface,
			borderColor: colors.accent,
		},
		text: { color: colors.text },
		capsule: {
			minHeight: 50,
			flexDirection: "row",
			alignItems: "center",
			paddingLeft: 18,
			paddingRight: spacing.xs,
		},
		capsuleBody: {
			flex: 1,
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
		},
		message: { flex: 1 },
		action: {
			minHeight: 44,
			justifyContent: "center",
			paddingHorizontal: spacing.sm,
		},
		actionText: { color: colors.accentInk, fontWeight: "700" },
	});
