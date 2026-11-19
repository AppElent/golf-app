/**
 * Clerk's error codes, turned into a catalog message in the phone's language.
 *
 * Every Clerk **Core 3** call (`@clerk/expo`) resolves to
 * `{ error: ClerkError | null }` rather than throwing, and `useSignIn()` /
 * `useSignUp()` additionally expose the last fetch's errors split into
 * `fields` and `global`. Both shapes carry a machine-stable `code` and a `message` Clerk's
 * own docs say not to show to a person, so the code is what gets mapped.
 * The `user` resource's methods (`update`, `updatePassword`,
 * `createEmailAddress`, …) throw instead; `clerkErrorEntries` reads those.
 *
 * A code not in `CODE_MAP` falls back to the generic message and — in dev —
 * logs the unmapped code, so the mapping can only grow by someone noticing a
 * gap.
 */
import type { Messages } from "../../i18n/messages/en";

export interface CodedError {
	code: string;
	message?: string;
}

export type AuthErrors = Messages["authErrors"];
export type AuthErrorKey = keyof AuthErrors;

const CODE_MAP: Record<string, AuthErrorKey> = {
	form_identifier_not_found: "identifierNotFound",
	form_password_incorrect: "passwordIncorrect",
	// The account exists but has no password (made with Apple, Microsoft or
	// an email code).
	strategy_for_user_invalid: "noPassword",
	form_identifier_exists: "identifierExists",
	form_email_address_exists: "identifierExists",
	form_password_length_too_short: "passwordTooShort",
	form_password_pwned: "passwordPwned",
	form_password_validation_failed: "passwordWeak",
	form_password_not_strong_enough: "passwordWeak",
	form_code_incorrect: "codeIncorrect",
	verification_failed: "codeIncorrect",
	verification_expired: "codeExpired",
	form_param_format_invalid: "emailInvalid",
	form_param_nil: "required",
	form_param_missing: "required",
	too_many_requests: "tooManyRequests",
	rate_limit_exceeded: "tooManyRequests",
	network_error: "network",
	// A sensitive change on a session older than Clerk's reverification window.
	session_reverification_required: "reverify",
	// Native Apple sheet: no Apple Account on the device, or its prompt closed.
	ERR_REQUEST_UNKNOWN: "appleIncomplete",
};

/** The catalog key for a Clerk error code; unknown codes read as `generic`. */
export function errorKey(error: CodedError): AuthErrorKey {
	const key = CODE_MAP[error.code];
	if (!key) {
		if (__DEV__) {
			console.warn(`[auth] unmapped Clerk error code: ${error.code}`);
		}
		return "generic";
	}
	return key;
}

/** `null` in, `null` out — so a call site can render this straight into an error message. */
export function readError(
	error: CodedError | null | undefined,
	messages: AuthErrors,
): string | null {
	return error ? messages[errorKey(error)] : null;
}

/** The shape of `useSignIn().errors` / `useSignUp().errors`. */
interface ErrorSignal<TFields extends object> {
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
	messages: AuthErrors,
): string | null {
	for (const field of Object.values(errors.fields) as (CodedError | null)[]) {
		if (field) return readError(field, messages);
	}
	return (
		readError(errors.global?.[0], messages) ?? readError(returned, messages)
	);
}

/** One entry of a thrown Clerk API error, with the form parameter it is about. */
export interface ClerkErrorEntry extends CodedError {
	/** `meta.paramName`, e.g. `current_password`; null for a form-level error. */
	param: string | null;
}

/**
 * The entries of an error a `user` method threw (`errors[]`), each with its
 * own `meta.paramName`. Clerk reports a wrong current password on
 * `user.updatePassword` with the same code as a weak new one, so only the
 * entry's parameter tells them apart. Empty for anything that is not a Clerk
 * API error (no network).
 */
export function clerkErrorEntries(error: unknown): ClerkErrorEntry[] {
	const errors = (error as { errors?: unknown } | null)?.errors;
	if (!Array.isArray(errors)) return [];
	return errors.flatMap((item) => {
		const entry = item as {
			code?: unknown;
			meta?: { paramName?: unknown };
		} | null;
		if (typeof entry?.code !== "string") return [];
		const param = entry.meta?.paramName;
		return [
			{
				code: entry.code,
				param: typeof param === "string" && param ? param : null,
			},
		];
	});
}

/**
 * The message for an error a `user` method threw: its first Clerk entry, or
 * the network message when it is not a Clerk API error at all.
 */
export function thrownErrorKey(error: unknown): AuthErrorKey {
	const [first] = clerkErrorEntries(error);
	return first ? errorKey(first) : "network";
}
