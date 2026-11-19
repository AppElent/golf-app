/**
 * Clerk reverification for the account screens, apart from React: which
 * factor to ask for, and what a session verification's status means here.
 *
 * Clerk asks a session that last verified more than 10 minutes ago to verify
 * again before it adds, removes or makes primary an email address, or sets
 * or changes a password (`session_reverification_required`). Expo has no
 * prebuilt prompt, so the app asks for the password or an emailed code.
 * Second factors (MFA) are not supported in the app yet.
 */

/** The minimal shape of Clerk's `SessionVerificationFirstFactor`. */
export interface FirstFactorLike {
	strategy: string;
	emailAddressId?: string;
	safeIdentifier?: string;
	primary?: boolean;
}

export type ReverifyFactor =
	| { strategy: "password" }
	| { strategy: "email_code"; emailAddressId: string; email: string };

/**
 * The factor to ask for: the password when the account has one (iOS can fill
 * it), else a code to an email address, the primary one first. Null when only
 * factors the app can't ask for (passkey, phone, SSO) are on offer.
 */
export function reverifyFactor(
	factors: readonly FirstFactorLike[] | null | undefined,
): ReverifyFactor | null {
	if (!factors) return null;
	if (factors.some((factor) => factor.strategy === "password")) {
		return { strategy: "password" };
	}
	const codes = factors.filter(
		(factor) => factor.strategy === "email_code" && factor.emailAddressId,
	);
	const pick = codes.find((factor) => factor.primary) ?? codes[0];
	if (!pick?.emailAddressId) return null;
	return {
		strategy: "email_code",
		emailAddressId: pick.emailAddressId,
		email: pick.safeIdentifier ?? "",
	};
}

/** What a session verification's status means for the prompt. */
export type ReverifyStep = "done" | "first-factor" | "unsupported";

export function reverifyStep(status: string): ReverifyStep {
	if (status === "complete") return "done";
	if (status === "needs_first_factor") return "first-factor";
	// `needs_second_factor`: MFA, which the app can't ask for yet.
	return "unsupported";
}
