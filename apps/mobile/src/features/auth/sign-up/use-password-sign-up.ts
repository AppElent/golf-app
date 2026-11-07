/**
 * The code is requested here, before the caller navigates, so `verify-email` is
 * only ever reached with a code already in flight.
 *
 * Clerk **Core 3**: calls resolve to `{ error }` instead of throwing, and the
 * mappable code lives on the hook's `errors` signal — see `pickError`.
 */
import { useSignUp } from "@clerk/expo";
import { useCallback } from "react";
import { pickError } from "../clerk-errors";
import { useClerkStep } from "../use-clerk-step";

export function usePasswordSignUp() {
	const { signUp, errors } = useSignUp();
	const { busy, returned, run } = useClerkStep();

	const submit = useCallback(
		(email: string, password: string) =>
			run(async (ok) => {
				const created = await signUp.password({
					emailAddress: email.trim(),
					password,
				});
				if (!ok(created)) return false;
				return ok(await signUp.verifications.sendEmailCode());
			}),
		[signUp, run],
	);

	return { submit, busy, error: pickError(errors, returned) };
}
