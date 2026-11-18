import { useRef } from "react";
import type { TextInputInstance } from "react-native";
import { AuthInput } from "./auth-form";
import {
	type CredentialsPurpose,
	emailFieldTraits,
	passwordFieldTraits,
} from "./credentials-model";
import type { CredentialsFormState } from "./use-credentials-form";

/**
 * Email and password, marked so the platform password manager fills sign-in,
 * and on sign-up offers a strong password (within Clerk's policy) and saves
 * it under the email. `form` (from `useCredentialsForm`) keeps the latest
 * native text, which AutoFill can change without `onChangeText`; the
 * keyboard's Go submits the password field's own text.
 */
export function CredentialsFields({
	purpose,
	emailLabel,
	passwordLabel,
	form,
}: {
	purpose: CredentialsPurpose;
	emailLabel: string;
	passwordLabel: string;
	form: CredentialsFormState;
}) {
	const passwordRef = useRef<TextInputInstance>(null);
	return (
		<>
			<AuthInput
				placeholder={emailLabel}
				{...form.field("email")}
				autoCapitalize="none"
				autoCorrect={false}
				keyboardType="email-address"
				{...emailFieldTraits}
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => passwordRef.current?.focus()}
			/>
			<AuthInput
				ref={passwordRef}
				placeholder={passwordLabel}
				{...form.field("password")}
				secureTextEntry
				autoCapitalize="none"
				{...passwordFieldTraits(purpose)}
				returnKeyType="go"
				onSubmitEditing={form.submitFrom("password")}
			/>
		</>
	);
}
