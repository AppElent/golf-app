/**
 * The signed-out half of the app.
 *
 * The guard is Clerk's `isSignedIn`, never Convex's `isAuthenticated` — the
 * two disagree for the length of the JWT handshake right after a sign-in,
 * and guarding on the Convex side produces an infinite bounce between this
 * group and `(app)`.
 */
import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
	const { isSignedIn } = useAuth();

	if (isSignedIn) {
		return <Redirect href="/" />;
	}

	return <Stack screenOptions={{ headerShown: false }} />;
}
