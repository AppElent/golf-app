/**
 * What lets a password manager offer, fill, generate, and save credentials
 * (developer-home auth standard, "Password managers").
 */
import type { TextInputProps } from "react-native";

export type CredentialsPurpose = "sign-in" | "sign-up";

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

export function passwordFieldTraits(purpose: CredentialsPurpose) {
	return purpose === "sign-up"
		? ({
				autoComplete: "new-password",
				textContentType: "newPassword",
				passwordRules: CLERK_PASSWORD_RULES,
			} as const satisfies TextInputProps)
		: ({
				autoComplete: "current-password",
				textContentType: "password",
			} as const satisfies TextInputProps);
}

/**
 * iOS AutoFill can set a field's text without `onChangeText` (declining the
 * strong-password offer clears it natively), so the state also takes the
 * field's native text when editing ends.
 */
export function syncNativeText(
	set: (text: string) => void,
): Pick<TextInputProps, "onChangeText" | "onEndEditing"> {
	return {
		onChangeText: set,
		onEndEditing: (event) => set(event.nativeEvent.text),
	};
}

export function credentialsReady(email: string, password: string) {
	return email.trim().length > 0 && password.length > 0;
}
