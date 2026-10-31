import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import {
	PREFERENCE_KEYS,
	readPreference,
	writePreference,
} from "../prefs/local-preference";
import {
	darkColors,
	lightColors,
	type Tokens,
} from "./tokens";

export type AppearancePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

function readAppearance(): AppearancePreference {
	const saved = readPreference(PREFERENCE_KEYS.appearance);
	return saved === "light" || saved === "dark" ? saved : "system";
}

type AppearanceValue = {
	preference: AppearancePreference;
	scheme: ColorScheme;
	colors: Tokens;
	setPreference: (next: AppearancePreference) => boolean;
};

const AppearanceContext = createContext<AppearanceValue | null>(null);

/** Phone-local preference, available before auth and before the first frame. */
/** React Native Web has no native appearance to override. */
function overrideNativeScheme(preference: AppearancePreference) {
	if (Platform.OS === "web") return;
	Appearance.setColorScheme(
		preference === "system" ? "unspecified" : preference,
	);
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
	const [preference, setStoredPreference] = useState(readAppearance);
	const nativeScheme = useColorScheme();
	const scheme =
		preference === "system"
			? nativeScheme === "dark"
				? "dark"
				: "light"
			: preference;

	useLayoutEffect(() => {
		overrideNativeScheme(preference);
	}, [preference]);

	const setPreference = useCallback((next: AppearancePreference) => {
		// Reset the native override before rendering System. RN reads the device
		// preference synchronously when its override becomes unspecified.
		overrideNativeScheme(next);
		const persisted = writePreference(PREFERENCE_KEYS.appearance, next);
		setStoredPreference(next);
		return persisted;
	}, []);

	const value = useMemo(
		() => ({
			preference,
			scheme,
			colors: scheme === "dark" ? darkColors : lightColors,
			setPreference,
		}),
		[preference, scheme, setPreference],
	);

	return <AppearanceContext value={value}>{children}</AppearanceContext>;
}

export function useAppearance(): AppearanceValue {
	const value = use(AppearanceContext);
	if (!value)
		throw new Error("useAppearance must be used within AppearanceProvider");
	return value;
}

export function useTokens(): Tokens {
	return useAppearance().colors;
}

/** Cache each stylesheet until the semantic palette changes. */
export function useThemedStyles<T>(createStyles: (colors: Tokens) => T): T {
	const colors = useTokens();
	return useMemo(() => createStyles(colors), [createStyles, colors]);
}

/** Native hosts and React content must use the same persisted appearance. */
export function useScheme(): ColorScheme {
	return useAppearance().scheme;
}
export function useHostScheme(): ColorScheme {
	return useScheme();
}
