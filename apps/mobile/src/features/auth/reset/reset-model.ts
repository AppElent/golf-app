/**
 * The rules of the forgotten-password flow, apart from Clerk and React.
 *
 * Clerk's `reset_password_email_code` runs on the one `signIn` attempt the
 * sign-in screen also uses: create the attempt for the address, send the
 * code, verify it (status `needs_new_password`), submit the new password
 * (status `complete`), then `finalize()` into a session.
 */

/** `entering` until Clerk accepts the new password. */
export type ResetStage = "entering" | "saved" | "needsWeb";

export const RESET_CODE_LENGTH = 6;

/**
 * The Clerk calls a reset submit still needs. A rejected password (too short,
 * breached) leaves the code verified, so a retry only resubmits the password;
 * verifying the used code again would fail.
 */
export function resetCalls(status: string): ("verify" | "submit")[] {
	return status === "needs_new_password" ? ["submit"] : ["verify", "submit"];
}

/**
 * Where a reset stands once Clerk accepted the new password. Mobile sign-in has
 * no second factors: any status but `complete` means the password changed but
 * no session follows here.
 */
export function stageAfterPassword(status: string): ResetStage {
	return status === "complete" ? "saved" : "needsWeb";
}

export function resetReady(
	stage: ResetStage,
	{ code, password }: { code: string; password: string },
): boolean {
	return (
		stage === "entering" &&
		code.trim().length === RESET_CODE_LENGTH &&
		password.length > 0
	);
}

/**
 * One action at a time on the shared attempt, across both reset routes: a
 * resend or start-over must never run while a reset is still in flight.
 */
export function createAttemptLock() {
	let busy = false;
	return {
		get busy() {
			return busy;
		},
		/** Runs `action` unless another is pending; then answers `blocked`. */
		async exclusive<T>(blocked: T, action: () => Promise<T>): Promise<T> {
			if (busy) return blocked;
			busy = true;
			try {
				return await action();
			} finally {
				busy = false;
			}
		},
	};
}

/** The lock both reset screens share. */
export const resetAttempt = createAttemptLock();
