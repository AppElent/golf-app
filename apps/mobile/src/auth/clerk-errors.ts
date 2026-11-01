/**
 * Clerk's error codes, turned into a message worth showing.
 *
 * Every Clerk **Core 3** call (`@clerk/expo`) resolves to
 * `{ error: ClerkError | null }` rather than throwing, and `useSignIn()` /
 * `useSignUp()` additionally expose the last fetch's errors split into
 * `fields` and `global`. Both shapes carry a machine-stable `code` and a `message` Clerk's
 * own docs say not to show to a person, so the code is what gets mapped.
 *
 * A code not in `CODE_MAP` falls back to a generic message and — in dev —
 * logs the unmapped code, so the mapping can only grow by someone noticing a
 * gap.
 */
export interface CodedError {
	code: string;
	message?: string;
}

const GENERIC = "Something went wrong. Please try again.";

const CODE_MAP: Record<string, string> = {
	form_identifier_not_found: "No account found with that email.",
	form_password_incorrect: "That password is not right.",
	form_identifier_exists: "An account with that email already exists.",
	form_password_length_too_short: "That password is too short.",
	form_password_pwned:
		"That password has appeared in a data breach. Choose another.",
	form_password_validation_failed: "That password is not strong enough.",
	form_code_incorrect: "That code is not right.",
	verification_failed: "That code is not right.",
	verification_expired: "That code has expired. Send a new one.",
	form_param_format_invalid: "Enter a valid email address.",
	form_param_nil: "This field is required.",
	form_param_missing: "This field is required.",
	too_many_requests: "Too many attempts. Try again in a moment.",
	rate_limit_exceeded: "Too many attempts. Try again in a moment.",
	network_error: "Network error. Check your connection and try again.",
	// Native Apple sheet: no Apple Account on the device, or its prompt closed.
	ERR_REQUEST_UNKNOWN:
		"Apple sign-in didn't finish. Check that you're signed in to your Apple Account in Settings.",
};

/** `null` in, `null` out — so a call site can render this straight into an error message. */
export function readError(error: CodedError | null | undefined): string | null {
	if (!error) return null;
	const mapped = CODE_MAP[error.code];
	if (!mapped) {
		if (__DEV__) {
			console.warn(`[auth] unmapped Clerk error code: ${error.code}`);
		}
		return GENERIC;
	}
	return mapped;
}

/** The shape of `useSignIn().errors` / `useSignUp().errors`. */
export interface ErrorSignal<TFields extends object> {
	fields: TFields;
	global: readonly CodedError[] | null;
}

/**
 * What to show after a failed Core 3 call.
 *
 * The `{ error }` a method resolves with is a **wrapper** — a wrong password
 * comes back as `api_response_error`, not `form_password_incorrect`. The
 * machine-stable code lives on the hook's `errors` signal instead
 * (`errors.fields.password.code`), which is why field errors are checked
 * first and the returned wrapper is only the fallback for failures that
 * never reach a field at all (no network, nothing to blame).
 */
export function pickError<TFields extends object>(
	errors: ErrorSignal<TFields>,
	returned: CodedError | null,
): string | null {
	for (const field of Object.values(errors.fields) as (CodedError | null)[]) {
		if (field) return readError(field);
	}
	return readError(errors.global?.[0]) ?? readError(returned);
}
