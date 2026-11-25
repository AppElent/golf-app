/**
 * The signed-in shell.
 *
 * Navigation follows Clerk (`isSignedIn` redirect), data follows Convex
 * (`ConvexSessionGate` below the redirect) — guarding the redirect on Convex
 * bounces between the groups during the JWT handshake.
 *
 * A plain Stack; the tab bar lives in the nested `(tabs)` group so the full-
 * screen Play route and the sheets can be pushed over it. While any of those
 * presented routes is in the stack, shake-to-report is paused: the feedback
 * form cannot present over them (`src/monitoring/shake-to-report.ts`).
 */
import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { type ReactNode, useMemo } from "react";
import { Platform, View } from "react-native";
import {
	ConvexSessionGate,
	ResumePlayAfterOffline,
} from "../../src/auth/convex-session-gate";
import { OfflineBanner } from "../../src/convex/offline-banner";
import { AppQueryCacheProvider } from "../../src/convex/query-cache";
import { KeepOfflineRound } from "../../src/features/play/offline/keep-offline-round";
import { PlayerEditorProvider } from "../../src/features/rounds/setup/player-editor-provider";
import { SimulationModeProvider } from "../../src/features/simulation/mode/simulation-mode-provider";
import {
	isPresentedRoute,
	useShakeToReportBlocker,
} from "../../src/monitoring/shake-to-report";
import { useTokens } from "../../src/theme";
import { ConfirmProvider } from "../../src/ui/confirm-dialog";
import { useBaseStackOptions } from "../../src/ui/stack-options";
import { ToastProvider } from "../../src/ui/toast";

export const unstable_settings = { anchor: "(tabs)" };

/** A shake must not open the feedback form under a presented sheet. */
function ShakeToReportGate({
	blocked,
	children,
}: {
	blocked: boolean;
	children: ReactNode;
}) {
	useShakeToReportBlocker(blocked);
	return children;
}

export default function AppLayout() {
	const colors = useTokens();
	const { isSignedIn, userId } = useAuth();
	const baseOptions = useBaseStackOptions();
	const screenOptions = useMemo(
		() => ({ ...baseOptions, headerShown: true, gestureEnabled: true }),
		[baseOptions],
	);

	if (!isSignedIn || !userId) return <Redirect href="/sign-in" />;

	return (
		<ToastProvider>
			<ConfirmProvider>
				<ConvexSessionGate>
					<AppQueryCacheProvider
						account={userId}
						fallback={<View style={{ flex: 1, backgroundColor: colors.bg }} />}
					>
						<SimulationModeProvider>
							<PlayerEditorProvider>
								<View style={{ flex: 1, backgroundColor: colors.bg }}>
									<OfflineBanner />
									<Stack
										layout={({ state, descriptors, children }) => (
											<ShakeToReportGate
												blocked={state.routes.some((route) =>
													isPresentedRoute(
														descriptors[route.key]?.options.presentation,
													),
												)}
											>
												{children}
											</ShakeToReportGate>
										)}
										screenOptions={screenOptions}
									>
										<Stack.Screen
											name="(tabs)"
											options={{ headerShown: false }}
										/>
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
												// One detent: four players fit without scrolling.
												sheetAllowedDetents: [1],
												sheetGrabberVisible: true,
												sheetCornerRadius: 28,
											}}
										/>
										<Stack.Screen
											name="setup-player"
											options={{
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
											name="handicap-table"
											options={
												// Android draws no header in a form sheet.
												Platform.OS === "ios"
													? {
															presentation: "formSheet",
															sheetAllowedDetents: [1],
															sheetGrabberVisible: true,
															sheetCornerRadius: 28,
														}
													: { presentation: "modal" }
											}
										/>
										<Stack.Screen
											name="suggest/[courseId]"
											options={{ presentation: "modal" }}
										/>
									</Stack>
									<ResumePlayAfterOffline />
									<KeepOfflineRound />
								</View>
							</PlayerEditorProvider>
						</SimulationModeProvider>
					</AppQueryCacheProvider>
				</ConvexSessionGate>
			</ConfirmProvider>
		</ToastProvider>
	);
}
