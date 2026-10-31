/**
 * Root of the app.
 *
 * The native splash stays up until Clerk has read the cached session out of
 * SecureStore and the window colour is set, so the router never mounts a
 * route before it knows which group (auth or app) is right.
 *
 * Provider order: language (a property of the phone, needed on signed-out
 * screens) → Clerk → Convex (one websocket whose auth follows the session,
 * mounted above the router so it is never torn down by navigation) →
 * appearance-aware navigation theme.
 */
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { publishableKey } from "../src/auth/config";
import { AppConvexProvider } from "../src/convex/provider";
// Defines the background location task at module scope (see the module).
import "../src/features/location/background/background-location";
import { LocaleProvider } from "../src/i18n";
import { AppearanceProvider, useAppearance, useTokens } from "../src/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	return (
		<AppearanceProvider>
			<ThemedRoot />
		</AppearanceProvider>
	);
}

function ThemedRoot() {
	const { scheme, colors } = useAppearance();
	const [windowReady, setWindowReady] = useState(false);
	const baseTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
	const styles = { window: { flex: 1, backgroundColor: colors.bg } };
	useEffect(() => {
		let active = true;
		SystemUI.setBackgroundColorAsync(colors.bg)
			.catch(() => {
				// React's root still paints the background if the OS rejects it.
			})
			.finally(() => {
				if (active) setWindowReady(true);
			});
		return () => {
			active = false;
		};
	}, [colors.bg]);
	const navigationTheme = {
		...baseTheme,
		colors: {
			...baseTheme.colors,
			primary: colors.accent,
			background: colors.bg,
			card: colors.surface,
			text: colors.text,
			border: colors.border,
			notification: colors.accent,
		},
	};

	return (
		<GestureHandlerRootView style={styles.window}>
			<LocaleProvider>
				<ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
					<AppConvexProvider>
						<SafeAreaProvider>
							<ThemeProvider value={navigationTheme}>
								<View style={styles.window}>
									<StatusBar style={scheme === "dark" ? "light" : "dark"} />
									<RootNavigator windowReady={windowReady} />
								</View>
							</ThemeProvider>
						</SafeAreaProvider>
					</AppConvexProvider>
				</ClerkProvider>
			</LocaleProvider>
		</GestureHandlerRootView>
	);
}

function RootNavigator({ windowReady }: { windowReady: boolean }) {
	const colors = useTokens();
	const { isLoaded } = useAuth();

	useEffect(() => {
		if (isLoaded && windowReady) SplashScreen.hideAsync();
	}, [isLoaded, windowReady]);

	// Still resolving the cached session; the splash covers this.
	if (!isLoaded || !windowReady) return null;

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: colors.bg },
			}}
		>
			<Stack.Screen name="(auth)" />
			<Stack.Screen name="(app)" />
		</Stack>
	);
}
