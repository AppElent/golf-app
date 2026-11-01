/**
 * Apple, Google and Microsoft, all the way to an active session.
 *
 * Apple on iOS goes through the native sheet (`@clerk/expo/apple`) — App
 * Store review requires it once any other social login is offered. Everything
 * else opens the provider in an in-app browser via Core 3's experimental
 * `useSSO()`, which also turns an unknown account into a sign-up and
 * activates the session itself. That browser returns to
 * `<scheme>://sso-callback` (one scheme per install variant, see
 * `app.config.ts`), which must be on the Clerk instance's allowed redirect URLs.
 *
 * Like `usePasswordSignIn`, nothing here navigates: a new session flips
 * `isSignedIn`, the `(auth)` layout redirects, and the caller unmounts.
 * Backing out of the sheet or browser is not an error and shows nothing.
 */
import { useSignInWithApple } from "@clerk/expo/apple";
import { useSSO } from "@clerk/expo/experimental";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { useI18n } from "../i18n";
import { type CodedError, readError } from "./clerk-errors";

export type SocialProvider = "apple" | "google" | "microsoft";

/**
 * Google only has working credentials on the development Clerk instance, so
 * it is offered in local dev builds only. Drop the `__DEV__` gate once the
 * production instance has its own Google OAuth client.
 */
export const SOCIAL_PROVIDERS: readonly SocialProvider[] = __DEV__
	? ["apple", "google", "microsoft"]
	: ["apple", "microsoft"];

/** Clerk throws either a bare `{ code }` or an `{ errors: [{ code }] }` wrapper. */
function toCoded(err: unknown): CodedError {
	const e = err as { code?: string; errors?: CodedError[] } | null;
	return e?.errors?.[0] ?? { code: e?.code ?? "unknown" };
}

export function useSocialSignIn() {
	const incomplete = useI18n().t.signIn.social.incomplete;
	const { startSSOFlow } = useSSO();
	const { startAppleAuthenticationFlow } = useSignInWithApple();
	const [pending, setPending] = useState<SocialProvider | null>(null);
	const [error, setError] = useState<string | null>(null);

	const start = useCallback(
		async (provider: SocialProvider) => {
			setPending(provider);
			setError(null);
			try {
				if (provider === "apple" && Platform.OS === "ios") {
					const { createdSessionId, setActive } =
						await startAppleAuthenticationFlow();
					if (createdSessionId && setActive) {
						await setActive({ session: createdSessionId });
						return;
					}
				} else {
					const { createdSessionId, signIn, authSessionResult } =
						await startSSOFlow({ strategy: `oauth_${provider}` });
					// Cancelled / dismissed: back to the form, no message.
					if (authSessionResult?.type !== "success") {
						setPending(null);
						return;
					}
					if (createdSessionId || signIn?.existingSession) return;
				}
				setError(incomplete);
			} catch (err) {
				const coded = toCoded(err);
				if (coded.code !== "ERR_REQUEST_CANCELED") {
					setError(readError(coded));
				}
			}
			setPending(null);
		},
		[startSSOFlow, startAppleAuthenticationFlow, incomplete],
	);

	return { start, pending, error };
}
