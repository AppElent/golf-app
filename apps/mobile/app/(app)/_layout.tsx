/**
 * The signed-in shell.
 *
 * Navigation follows Clerk (`isSignedIn` redirect), data follows Convex
 * (`ConvexSessionGate` below the redirect) — guarding the redirect on Convex
 * bounces between the groups during the JWT handshake.
 *
 * A plain Stack; the tab bar lives in the nested `(tabs)` group so the full-
 * screen Play route and the sheets can be pushed over it.
 */
import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { useMemo } from "react";
import { Platform, View } from "react-native";
import { ConvexSessionGate } from "../../src/auth/convex-session-gate";
import { OfflineBanner } from "../../src/convex/offline-banner";
import { AppQueryCacheProvider } from "../../src/convex/query-cache";
import { useTokens } from "../../src/theme";
import { ConfirmProvider } from "../../src/ui/confirm-dialog";
import { useBaseStackOptions } from "../../src/ui/stack-options";
import { ToastProvider } from "../../src/ui/toast";

export const unstable_settings = { anchor: "(tabs)" };

export default function AppLayout() {
	const colors = useTokens();
	const { isSignedIn, userId } = useAuth();
	const baseOptions = useBaseStackOptions();
	const screenOptions = useMemo(
		() => ({ ...baseOptions, headerShown: true, gestureEnabled: true }),
		[baseOptions],
	);

	if (!isSignedIn) return <Redirect href="/sign-in" />;

	return (
		<ToastProvider>
			<ConfirmProvider>
				<ConvexSessionGate>
					<AppQueryCacheProvider scope={userId}>
						<View style={{ flex: 1, backgroundColor: colors.bg }}>
							<OfflineBanner />
							<Stack screenOptions={screenOptions}>
								<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
								<Stack.Screen
									name="play"
									options={{
										headerShown: false,
										presentation: "fullScreenModal",
										gestureEnabled: false,
									}}
								/>
								<Stack.Screen
									name="score"
									options={{
										// iOS titles the sheet natively (see score-sheet-screen).
										headerShown: Platform.OS === "ios",
										presentation: "formSheet",
										sheetAllowedDetents: [0.62, 1],
										sheetGrabberVisible: true,
										sheetCornerRadius: 28,
									}}
								/>
								<Stack.Screen
									name="scorecard"
									options={{ presentation: "modal" }}
								/>
								<Stack.Screen
									name="suggest/[courseId]"
									options={{ presentation: "modal" }}
								/>
							</Stack>
						</View>
					</AppQueryCacheProvider>
				</ConvexSessionGate>
			</ConfirmProvider>
		</ToastProvider>
	);
}
