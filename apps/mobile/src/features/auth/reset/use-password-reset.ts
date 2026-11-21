/**
 * Forgotten password: email a 6-digit reset code, then trade the code and a
 * new password for a session (Clerk `reset_password_email_code`).
 *
 * `request` runs on `forgot-password`, `reset` / `resend` / `startOver` on
 * `reset-password`; Clerk's `signIn` resource survives the navigation in
 * between. All four act on that one attempt, so `resetAttempt` lets only one
 * run at a time across both routes; `locked` reports this hook's own pending
 * action to its screen.
 *
 * Resetting signs the account out of its other sessions: someone who lost
 * their password may also have lost a device. Once Clerk accepts the password
 * the stage is `saved` and a failed `finalize()` is retried with `finish`.
 * When `finalize()` lands, `isSignedIn` flips, the `(auth)` layout redirects,
 * and the caller unmounts — so `busy` is only cleared on failure.
 *
 * Errors show only once this screen has acted: the `signIn` signal may still
 * hold the sign-in screen's last error (a wrong password) on arrival.
 */
import { useSignIn } from "@clerk/expo";
import { useCallback, useState } from "react";
import { useI18n } from "../../../i18n";
import { pickError } from "../clerk-errors";
import { useClerkStep } from "../use-clerk-step";
import {
	type ResetStage,
	resetAttempt,
	resetCalls,
	stageAfterPassword,
} from "./reset-model";

export function usePasswordReset() {
	const { signIn, errors } = useSignIn();
	const { t } = useI18n();
	const { busy, returned, clearReturned, run } = useClerkStep();
	const [stage, setStage] = useState<ResetStage>("entering");
	const [acted, setActed] = useState(false);
	const [resending, setResending] = useState(false);
	const [startingOver, setStartingOver] = useState(false);

	const request = useCallback(
		(email: string): Promise<boolean> =>
			resetAttempt.exclusive(false, () => {
				setActed(true);
				return run(
					async (ok) =>
						ok(await signIn.create({ identifier: email.trim() })) &&
						ok(await signIn.resetPasswordEmailCode.sendCode()),
				);
			}),
		[signIn, run],
	);

	const resend = useCallback(
		(): Promise<boolean> =>
			resetAttempt.exclusive(false, async () => {
				setActed(true);
				setResending(true);
				const sent = await run(
					async (ok) => ok(await signIn.resetPasswordEmailCode.sendCode()),
					"none",
				);
				setResending(false);
				return sent;
			}),
		[signIn, run],
	);

	/**
	 * Drops the attempt so a corrected address starts a fresh reset. False
	 * while another action is pending: the screen then stays put.
	 */
	const startOver = useCallback(
		(): Promise<boolean> =>
			resetAttempt.exclusive(false, async () => {
				setStartingOver(true);
				clearReturned();
				try {
					await signIn.reset();
				} catch {
					// Nothing to undo: the screen stays, and the next request
					// creates a fresh attempt anyway.
				}
				setStartingOver(false);
				setStage("entering");
				return true;
			}),
		[signIn, clearReturned],
	);

	/** Turns the completed attempt into a session; retried after a failure. */
	const finish = useCallback(
		(): Promise<void> =>
			resetAttempt.exclusive(undefined, async () => {
				setActed(true);
				await run(async (ok) => ok(await signIn.finalize()), "hold");
			}),
		[signIn, run],
	);

	const reset = useCallback(
		(code: string, password: string): Promise<void> =>
			resetAttempt.exclusive(undefined, async () => {
				if (stage !== "entering") return;
				setActed(true);
				await run(async (ok) => {
					for (const call of resetCalls(signIn.status)) {
						const result =
							call === "verify"
								? await signIn.resetPasswordEmailCode.verifyCode({
										code: code.trim(),
									})
								: await signIn.resetPasswordEmailCode.submitPassword({
										password,
										signOutOfOtherSessions: true,
									});
						if (!ok(result)) return false;
					}
					const next = stageAfterPassword(signIn.status);
					setStage(next);
					if (next !== "saved") {
						if (__DEV__) {
							console.warn(
								`[auth] password reset stopped at an unhandled status: ${signIn.status}`,
							);
						}
						return false;
					}
					return ok(await signIn.finalize());
				}, "hold");
			}),
		[signIn, run, stage],
	);

	const error =
		stage === "needsWeb"
			? t.resetPassword.changedNeedsStep
			: acted
				? pickError(errors, returned, t.authErrors)
				: null;

	return {
		request,
		resend,
		resending,
		startOver,
		reset,
		finish,
		stage,
		busy,
		/** True while any action of this screen on the attempt is pending. */
		locked: busy || resending || startingOver,
		error,
	};
}
