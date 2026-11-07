/** A mutation that fails must say so; a tap that appears to do nothing is the default otherwise. */
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
import { radius, spacing, type Tokens, useThemedStyles } from "../theme";
import { AppText } from "./text";

type ToastKind = "error" | "success";
type Toast = { kind: ToastKind; message: string };

type ToastApi = {
	error: (message: string) => void;
	success: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Long enough to read a sentence, short enough not to sit in the way. */
const DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
	const styles = useThemedStyles(createStyles);
	const [toast, setToast] = useState<Toast | null>(null);
	const insets = useSafeAreaInsets();

	useEffect(() => {
		if (!toast) return;
		const timer = setTimeout(() => setToast(null), DISMISS_MS);
		return () => clearTimeout(timer);
	}, [toast]);

	const api = useMemo<ToastApi>(() => {
		const push = (kind: ToastKind) => (message: string) =>
			setToast({ kind, message });
		return { error: push("error"), success: push("success") };
	}, []);

	return (
		<ToastContext.Provider value={api}>
			{children}
			{toast ? (
				<View
					style={[styles.wrap, { top: insets.top + spacing.sm }]}
					pointerEvents="box-none"
				>
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
	});
