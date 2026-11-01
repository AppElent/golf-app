/**
 * Email and password, an emailed code (`sign-in-code`), or a social provider
 * (`SocialButtons`). No reset yet: it is a Clerk flow with its own screens.
 * New accounts start at `sign-up`.
 *
 * The submit does not navigate: `finalize()` (in `usePasswordSignIn`) flips
 * `isSignedIn`, the `(auth)` layout above redirects to `/`, and this screen
 * unmounts.
 *
 * `autoComplete` / `textContentType` are what let the platform password
 * manager fill this — and offer to save the password made on `sign-up`.
 */
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";

import {
	AuthInput,
	AuthLink,
	AuthMessage,
	AuthScreen,
	AuthSubmit,
} from "../../src/auth/auth-form";
import { devLogin } from "../../src/auth/config";
import { SocialButtons } from "../../src/auth/social-buttons";
import { useEmailCodeSignIn } from "../../src/auth/use-email-code-sign-in";
import { usePasswordSignIn } from "../../src/auth/use-password-sign-in";
import { useI18n } from "../../src/i18n";
import { AppText } from "../../src/ui/text";

export default function SignIn() {
	const router = useRouter();
	const copy = useI18n().t.signIn;
	const { submit, busy, error } = usePasswordSignIn();
	const emailCode = useEmailCodeSignIn();
	const [codeHint, setCodeHint] = useState<string | null>(null);
	const [email, setEmail] = useState(devLogin?.email ?? "");
	const [password, setPassword] = useState(devLogin?.password ?? "");
	const passwordRef = useRef<TextInputInstance>(null);

	const ready = email.trim().length > 0 && password.length > 0;

	async function sendCode() {
		setCodeHint(null);
		if (!email.trim()) {
			setCodeHint(copy.emailFirst);
			return;
		}
		if (await emailCode.send(email)) {
			router.push({
				pathname: "/sign-in-code",
				params: { email: email.trim() },
			});
		}
	}

	return (
		<AuthScreen
			title="Fairway"
			subtitle={copy.tagline}
			footer={
				<>
					<AuthLink label={copy.emailCode} onPress={sendCode} />
					<AuthLink
						prompt={copy.noAccount}
						label={copy.createAccount}
						onPress={() => router.replace("/sign-up")}
					/>
					{devLogin ? (
						<AppText variant="caption" style={{ textAlign: "center" }}>
							{copy.devNote}
						</AppText>
					) : null}
				</>
			}
		>
			<AuthInput
				placeholder={copy.email}
				value={email}
				onChangeText={setEmail}
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
				placeholder={copy.password}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="current-password"
				textContentType="password"
				returnKeyType="go"
				onSubmitEditing={() => ready && submit(email, password)}
			/>

			<AuthMessage message={codeHint ?? emailCode.error ?? error} />

			<AuthSubmit
				label={copy.submit}
				busy={busy || emailCode.busy}
				disabled={!ready}
				onPress={() => submit(email, password)}
				testID="sign-in-submit"
			/>

			<SocialButtons />
		</AuthScreen>
	);
}
