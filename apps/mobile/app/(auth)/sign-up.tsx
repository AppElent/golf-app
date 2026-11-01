/**
 * Create an account: email, password, then a code to prove the address.
 *
 * The code is requested *here*, before navigating, so `verify-email` is only
 * ever reached with a code already in flight. Sending it from the verify
 * screen's mount would re-send on every remount, and Clerk rate-limits that.
 *
 * `autoComplete="new-password"` is what makes the platform offer to generate
 * and save a password, which is what later fills the sign-in screen.
 *
 * Clerk **Core 3**: calls resolve to `{ error }` instead of throwing, and the
 * mappable code lives on the hook's `errors` signal — see `pickError`.
 */
import { useSignUp } from "@clerk/expo";
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
import { type CodedError, pickError } from "../../src/auth/clerk-errors";
import { SocialButtons } from "../../src/auth/social-buttons";
import { useI18n } from "../../src/i18n";

export default function SignUp() {
	const router = useRouter();
	const copy = useI18n().t.signUp;
	const { signUp, errors } = useSignUp();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [returned, setReturned] = useState<CodedError | null>(null);
	const passwordRef = useRef<TextInputInstance>(null);

	const ready = email.trim().length > 0 && password.length > 0;
	const error = pickError(errors, returned);

	async function submit() {
		setBusy(true);
		setReturned(null);

		const created = await signUp.password({
			emailAddress: email.trim(),
			password,
		});
		if (created.error) {
			setReturned(created.error);
			setBusy(false);
			return;
		}

		const sent = await signUp.verifications.sendEmailCode();
		if (sent.error) {
			setReturned(sent.error);
			setBusy(false);
			return;
		}

		setBusy(false);
		router.push({
			pathname: "/verify-email",
			params: { email: email.trim() },
		});
	}

	return (
		<AuthScreen
			title={copy.title}
			subtitle={copy.subtitle}
			footer={
				<AuthLink
					prompt={copy.haveAccount}
					label={copy.signIn}
					onPress={() => router.replace("/sign-in")}
				/>
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
				autoComplete="new-password"
				textContentType="newPassword"
				returnKeyType="go"
				onSubmitEditing={() => ready && !busy && submit()}
			/>

			<AuthMessage message={error} />

			<AuthSubmit
				label={copy.submit}
				busy={busy}
				disabled={!ready}
				onPress={submit}
			/>

			<SocialButtons />
		</AuthScreen>
	);
}
