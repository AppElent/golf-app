/**
 * `send` runs on the sign-in screen (the address is already typed there) and
 * `verify` / `resend` on `sign-in-code`. Clerk's `signIn` resource survives
 * the navigation in between, the same way `signUp` does for `verify-email`.
 *
 * Core 3 again: calls resolve to `{ error }`, and a verified code still needs
 * `finalize()` before `isSignedIn` flips — at which point the `(auth)` layout
 * redirects and the caller unmounts, so `busy` is only cleared on failure.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback } from "react";
import { pickError } from "../clerk-errors";
import { useClerkStep } from "../use-clerk-step";
import { useResend } from "../use-resend";

export function useEmailCodeSignIn() {
	const { signIn, errors } = useSignIn();
	const { busy, returned, clearReturned, run } = useClerkStep();

	const send = useCallback(
		(email: string) =>
			run(async (ok) =>
				ok(await signIn.emailCode.sendCode({ emailAddress: email.trim() })),
			),
		[signIn, run],
	);

	/** Re-sends to the address of the sign-in already in progress. */
	const { resend, resending, notice, clearNotice } = useResend(() =>
		run(async (ok) => ok(await signIn.emailCode.sendCode()), "none"),
	);

	/**
	 * Drops the attempt so a corrected address starts a fresh sign-in: once
	 * one exists, `sendCode` must not be given an address again.
	 */
	const startOver = useCallback(async () => {
		clearReturned();
		await signIn.reset();
	}, [signIn, clearReturned]);

	const verify = useCallback(
		(code: string) => {
			clearNotice();
			return run(async (ok) => {
				if (!ok(await signIn.emailCode.verifyCode({ code }))) return false;
				return ok(await signIn.finalize());
			}, "hold");
		},
		[signIn, run, clearNotice],
	);

	return {
		send,
		resend,
		resending,
		notice,
		startOver,
		verify,
		busy,
		error: pickError(errors, returned),
	};
}
