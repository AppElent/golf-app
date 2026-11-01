import { useAuth } from "@clerk/react";
import * as Sentry from "@sentry/react";
import { useEffect } from "react";

/**
 * Tags events with the opaque Clerk user id only — no email or name — and
 * clears it on sign-out and unmount. Render inside `ClerkProvider`.
 */
export function SentryUser() {
	const { isLoaded, userId } = useAuth();
	useEffect(() => {
		Sentry.setUser(isLoaded && userId ? { id: userId } : null);
		return () => Sentry.setUser(null);
	}, [isLoaded, userId]);
	return null;
}
