/**
 * Keeps a reset screen in place while it waits on Clerk. The reset and
 * ordinary sign-in share one Clerk sign-in attempt, so leaving mid-call and
 * starting a sign-in would overlap the two on it. The back swipe and
 * `router.back()` wait until the call settles; nothing is shown.
 *
 * Once the attempt has signed in, the `(auth)` layout redirects away; that is
 * never held.
 */
import { useAuth } from "@clerk/expo";
import { Stack, usePreventRemove } from "expo-router";

export function HoldWhileBusy({ busy }: { busy: boolean }) {
	const { isSignedIn } = useAuth();
	const held = busy && !isSignedIn;
	usePreventRemove(held, () => {});
	return <Stack.Screen options={{ gestureEnabled: !held }} />;
}
