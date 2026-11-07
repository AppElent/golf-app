import { useRef } from "react";
import type { TextInputInstance } from "react-native";
import { AuthInput } from "./auth-form";

/**
 * Email and password. `autoComplete` / `textContentType` are what let the
 * platform password manager fill sign-in, and offer to generate and save a
 * password on sign-up (`new-password`), which later fills sign-in.
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
	purpose: "sign-in" | "sign-up";
	emailLabel: string;
	passwordLabel: string;
	email: string;
	password: string;
	onEmailChange: (next: string) => void;
	onPasswordChange: (next: string) => void;
	onSubmit: () => void;
}) {
	const passwordRef = useRef<TextInputInstance>(null);
	return (
		<>
			<AuthInput
				placeholder={emailLabel}
				value={email}
				onChangeText={onEmailChange}
				autoCapitalize="none"
				autoCorrect={false}
				keyboardType="email-address"
				autoComplete="email"
				textContentType="username"
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => passwordRef.current?.focus()}
			/>
			<AuthInput
				ref={passwordRef}
				placeholder={passwordLabel}
				value={password}
				onChangeText={onPasswordChange}
				secureTextEntry
				autoCapitalize="none"
				autoComplete={
					purpose === "sign-up" ? "new-password" : "current-password"
				}
				textContentType={purpose === "sign-up" ? "newPassword" : "password"}
				returnKeyType="go"
				onSubmitEditing={onSubmit}
			/>
		</>
	);
}
