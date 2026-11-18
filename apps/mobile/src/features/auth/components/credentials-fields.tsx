import { useRef } from "react";
import type { TextInputInstance } from "react-native";
import { AuthInput } from "./auth-form";
import {
	type CredentialsPurpose,
	emailFieldTraits,
	passwordFieldTraits,
	syncNativeText,
} from "./credentials-model";

/**
 * Email and password, marked so the platform password manager fills sign-in,
 * and on sign-up offers a strong password (within Clerk's policy) and saves
 * it under the email. Both fields also sync from `onEndEditing`, and the
 * keyboard's Go hands `onSubmit` the password field's native text: AutoFill
 * can change a field without `onChangeText`.
 */
export function CredentialsFields({
	purpose,
	emailLabel,
	passwordLabel,
	email,
	password,
	onEmailChange,
	onPasswordChange,
	onSubmit,
}: {
	purpose: CredentialsPurpose;
	emailLabel: string;
	passwordLabel: string;
	email: string;
	password: string;
	onEmailChange: (next: string) => void;
	onPasswordChange: (next: string) => void;
	/** `password` is the field's latest text. */
	onSubmit: (password: string) => void;
}) {
	const passwordRef = useRef<TextInputInstance>(null);
	return (
		<>
			<AuthInput
				placeholder={emailLabel}
				value={email}
				{...syncNativeText(onEmailChange)}
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
				value={password}
				{...syncNativeText(onPasswordChange)}
				secureTextEntry
				autoCapitalize="none"
				{...passwordFieldTraits(purpose)}
				returnKeyType="go"
				onSubmitEditing={(event) => {
					onPasswordChange(event.nativeEvent.text);
					onSubmit(event.nativeEvent.text);
				}}
			/>
		</>
	);
}
