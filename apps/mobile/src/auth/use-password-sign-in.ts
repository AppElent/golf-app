/**
 * Email + password, all the way to an active session.
 *
 * Clerk **Core 3** (`@clerk/expo`) trap: a successful `signIn.password()`
 * leaves the sign-in `'complete'` but **not** signed in. `finalize()` is
 * what promotes it to the active session — skipping it produces a flow that
 * reports success and leaves the person exactly where they were. The web
 * forms (`src/lib/auth`, `@clerk/react`) follow the same Core 3 contract.
 *
 * Nothing here navigates. When `finalize()` lands, `isSignedIn` flips, the
 * `(auth)` layout redirects, and this component unmounts out from under the
 * caller — which is also why `busy` is only ever cleared on the failure
 * paths.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { type CodedError, pickError } from "./clerk-errors";

export function usePasswordSignIn() {
	const { signIn, errors } = useSignIn();
	const [busy, setBusy] = useState(false);
	const [returned, setReturned] = useState<CodedError | null>(null);
	const [override, setOverride] = useState<string | null>(null);

	const submit = useCallback(
		async (email: string, password: string) => {
			setBusy(true);
			setReturned(null);
			setOverride(null);

			const attempt = await signIn.password({
				identifier: email.trim(),
				password,
			});
			if (attempt.error) {
				setReturned(attempt.error);
				setBusy(false);
				return;
			}

			if (signIn.status !== "complete") {
				if (__DEV__) {
					console.warn(
						`[auth] sign-in stopped at an unhandled status: ${signIn.status}`,
					);
				}
				setOverride(
					"Sign-in needs another step this app doesn't support yet. Try the web app instead.",
				);
				setBusy(false);
				return;
			}

			const finalized = await signIn.finalize();
			if (finalized.error) {
				setReturned(finalized.error);
				setBusy(false);
			}
		},
		[signIn],
	);

	return {
		submit,
		busy,
		error: override ?? pickError(errors, returned),
	};
}
