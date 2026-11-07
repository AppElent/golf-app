/**
 * The sign-up lives on Clerk's `signUp` resource, which survives the navigation
 * to `verify-email`. As with sign-in, `finalize()` turns a complete sign-up into
 * a session; the `(auth)` layout then redirects and the caller unmounts.
 */
import { useSignUp } from "@clerk/expo";
import { pickError } from "../clerk-errors";
import { useClerkStep } from "../use-clerk-step";
import { useResend } from "../use-resend";

export function useVerifyEmail() {
	const { signUp, errors } = useSignUp();
	const { busy, returned, run } = useClerkStep();
	const { resend, resending, notice, clearNotice } = useResend(() =>
		run(async (ok) => ok(await signUp.verifications.sendEmailCode()), "none"),
	);

	async function verify(code: string) {
		clearNotice();
		await run(async (ok) => {
			const verified = await signUp.verifications.verifyEmailCode({ code });
			if (!ok(verified)) return false;
			return ok(await signUp.finalize());
		}, "hold");
	}

	return {
		verify,
		resend,
		resending,
		busy,
		notice,
		error: pickError(errors, returned),
	};
}
