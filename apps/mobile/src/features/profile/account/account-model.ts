/**
 * The account screens' rules, apart from Clerk and React: what Profile shows
 * for the name, email addresses and password, and which Clerk error belongs to
 * which field. Clerk owns all of it; Convex keeps no copy (it keys data on
 * the Clerk user id alone).
 */
import {
	type AuthErrorKey,
	clerkErrorEntries,
	errorKey,
} from "../../auth/clerk-errors";

export const EMAIL_CODE_LENGTH = 6;

/** "First Last", either part alone, or null when neither is set. */
export function displayName(
	firstName: string | null | undefined,
	lastName: string | null | undefined,
): string | null {
	const name = [firstName, lastName]
		.map((part) => part?.trim())
		.filter(Boolean)
		.join(" ");
	return name || null;
}

/** What `user.update` gets: an emptied field clears the name part. */
export function nameUpdate(firstName: string, lastName: string) {
	return { firstName: firstName.trim(), lastName: lastName.trim() };
}

/**
 * An account made with Apple, Google, Microsoft or an email code has no
 * password: it sets one (no current password asked), the rest change theirs.
 */
export type PasswordMode = "change" | "set";

export function passwordMode(passwordEnabled: boolean): PasswordMode {
	return passwordEnabled ? "change" : "set";
}

export interface PasswordValues {
	current: string;
	next: string;
}

export function passwordReady(mode: PasswordMode, values: PasswordValues) {
	return (
		values.next.length > 0 && (mode === "set" || values.current.length > 0)
	);
}

/** The minimal shape of a Clerk `EmailAddressResource` these screens read. */
export interface EmailLike {
	id: string;
	emailAddress: string;
	verification: { status: string | null } | null;
}

export type EmailStatus = "primary" | "verified" | "unverified";

export interface EmailRow {
	id: string;
	email: string;
	status: EmailStatus;
	/** Making an address primary needs it verified first. */
	canMakePrimary: boolean;
	/** The primary address is the sign-in name; change the primary first. */
	canRemove: boolean;
	canVerify: boolean;
}

/** The primary address first, then the rest in Clerk's order. */
export function emailRows(
	addresses: readonly EmailLike[],
	primaryId: string | null | undefined,
): EmailRow[] {
	const rows = addresses.map((address): EmailRow => {
		const verified = address.verification?.status === "verified";
		const primary = address.id === primaryId;
		return {
			id: address.id,
			email: address.emailAddress,
			status: primary ? "primary" : verified ? "verified" : "unverified",
			canMakePrimary: !primary && verified,
			canRemove: !primary,
			canVerify: !verified,
		};
	});
	return [
		...rows.filter((row) => row.status === "primary"),
		...rows.filter((row) => row.status !== "primary"),
	];
}

export type PasswordField = "current" | "next";

const FIELD_BY_PARAM: Record<string, PasswordField> = {
	current_password: "current",
	new_password: "next",
	password: "next",
};

/** Codes Clerk uses on `current_password` when that password is wrong. */
const WRONG_CURRENT = new Set([
	"form_password_validation_failed",
	"form_password_incorrect",
]);

/**
 * Sorts a failed `user.updatePassword` by field: the first entry per field
 * wins, entries about no field go to the form. Clerk reports a wrong current
 * password as `form_password_validation_failed` on `current_password`, the
 * same code as a weak new one, so the entry's parameter decides. A failure
 * that is not a Clerk API error (no network) is a form error.
 */
export function passwordErrors(failure: unknown): {
	fields: Partial<Record<PasswordField, AuthErrorKey>>;
	form: AuthErrorKey | null;
} {
	const fields: Partial<Record<PasswordField, AuthErrorKey>> = {};
	let form: AuthErrorKey | null = null;
	const entries = clerkErrorEntries(failure);
	for (const entry of entries) {
		const field = entry.param ? FIELD_BY_PARAM[entry.param] : undefined;
		if (!field) {
			form ??= errorKey(entry);
		} else if (!fields[field]) {
			fields[field] =
				field === "current" && WRONG_CURRENT.has(entry.code)
					? "passwordIncorrect"
					: errorKey(entry);
		}
	}
	if (entries.length === 0) form = "network";
	return { fields, form };
}
