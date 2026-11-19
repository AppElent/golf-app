/**
 * What lets a password manager offer, fill, generate, and save credentials
 * (developer-home auth standard, "Password managers").
 */
import type { TextInputProps } from "react-native";

export type CredentialsPurpose = "sign-in" | "sign-up";
export type Credentials = { email: string; password: string };
export type CredentialKey = keyof Credentials;

/**
 * iOS `passwordRules` for the Clerk instance's password policy, so a
 * generated strong password always passes Clerk. Fairway's Clerk instance
 * uses Clerk's default policy: at least 8 characters, no required classes.
 * Change this together with the Clerk dashboard's password settings.
 */
export const CLERK_PASSWORD_RULES = "minlength: 8;";

/** The email field is the account name the manager saves the password under. */
export const emailFieldTraits = {
	autoComplete: "username",
	textContentType: "username",
} as const satisfies TextInputProps;

/**
 * A password the account already has: the manager fills the saved one (sign-in,
 * the current field of change password).
 */
export const currentPasswordTraits = {
	autoComplete: "current-password",
	textContentType: "password",
} as const satisfies TextInputProps;

/**
 * A password being chosen (sign-up, reset, the new field of change password):
 * the manager offers a strong one within Clerk's policy and saves it under the
 * account named by the `username` field above it.
 */
export const newPasswordTraits = {
	autoComplete: "new-password",
	textContentType: "newPassword",
	passwordRules: CLERK_PASSWORD_RULES,
} as const satisfies TextInputProps;

export function passwordFieldTraits(purpose: CredentialsPurpose) {
	return purpose === "sign-up" ? newPasswordTraits : currentPasswordTraits;
}

/**
 * A read-only field that names the account on a screen that sets a password
 * (reset, change, set): without it iOS AutoFill reads the password fields as
 * belonging to no account, or a current and new pair as two new passwords.
 */
export const accountNameFieldTraits = {
	...emailFieldTraits,
	editable: false,
	autoCapitalize: "none",
	autoCorrect: false,
} as const satisfies TextInputProps;

export function credentialsReady({ email, password }: Credentials) {
	return email.trim().length > 0 && password.length > 0;
}

/**
 * The submit rules for a credential form (any set of text fields: email and
 * password, code and new password, current and new password) whose fields iOS AutoFill can change
 * silently. AutoFill (and declining its "Use Strong Password?" offer) can set
 * or clear a field without `onChangeText`; the app only learns the text from
 * that field's `onEndEditing`.
 *
 * - Every field event writes the latest text synchronously.
 * - `press` (the primary button) never trusts a focused field: it blurs it and
 *   submits from that field's `onEndEditing`, once its final text is known.
 *   With nothing focused it submits the latest text straight away.
 * - `submitEditing` (the keyboard's Go) submits the text its own event carries.
 * - `onEditing` reports whether a field is focused, so the button can stay
 *   enabled after a fill the app has not heard about yet.
 *
 * `submit` gets the latest text and decides whether it is ready.
 */
export function createCredentialsForm<K extends string = CredentialKey>(
	initial: Record<K, string>,
	io: {
		onValues: (values: Record<K, string>) => void;
		onEditing: (editing: boolean) => void;
		focusedInput: () => { blur(): void } | null | undefined;
		submit: (values: Record<K, string>) => void;
	},
) {
	let values = initial;
	let pendingSubmit = false;

	const set = (key: K, text: string) => {
		values = { ...values, [key]: text };
		io.onValues(values);
	};
	const submitNow = () => {
		pendingSubmit = false;
		io.submit(values);
	};

	return {
		changeText: set,
		focus() {
			pendingSubmit = false;
			io.onEditing(true);
		},
		endEditing(key: K, text: string) {
			set(key, text);
			io.onEditing(false);
			if (pendingSubmit) submitNow();
		},
		press() {
			const focused = io.focusedInput();
			if (focused) {
				pendingSubmit = true;
				focused.blur();
			} else {
				submitNow();
			}
		},
		submitEditing(key: K, text: string) {
			set(key, text);
			submitNow();
		},
	};
}
