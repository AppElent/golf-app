/**
 * Email + password, all the way to an active session.
 *
 * Clerk **Core 3** (`@clerk/expo`) trap: a successful `signIn.password()`
 * leaves the sign-in `'complete'` but **not** signed in. `finalize()` is
 * what promotes it to the active session — skipping it produces a flow that
 * reports success and leaves the person exactly where they were.
 *
 * Nothing here navigates. When `finalize()` lands, `isSignedIn` flips, the
 * `(auth)` layout redirects, and this component unmounts out from under the
 * caller — which is also why `busy` is only ever cleared on the failure
 * paths.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { pickError } from "../clerk-errors";
import { useClerkStep } from "../use-clerk-step";

export function usePasswordSignIn() {
	const { signIn, errors } = useSignIn();
	const { busy, returned, run } = useClerkStep();
	const [override, setOverride] = useState<string | null>(null);

	const submit = useCallback(
		async (email: string, password: string) => {
			setOverride(null);
			await run(async (ok) => {
				const attempt = await signIn.password({
					identifier: email.trim(),
					password,
				});
				if (!ok(attempt)) return false;

				if (signIn.status !== "complete") {
					if (__DEV__) {
						console.warn(
							`[auth] sign-in stopped at an unhandled status: ${signIn.status}`,
						);
					}
					setOverride(
						"Sign-in needs another step this app doesn't support yet. Try the web app instead.",
					);
					return false;
				}

				return ok(await signIn.finalize());
			}, "hold");
		},
		[signIn, run],
	);

	return {
		submit,
		busy,
		error: override ?? pickError(errors, returned),
	};
}
