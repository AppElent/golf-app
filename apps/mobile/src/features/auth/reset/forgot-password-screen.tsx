/**
 * First half of the password reset: the address the code goes to. The sign-in
 * screen passes what was already typed there. `reset-password` takes the code
 * and the new password; see `usePasswordReset`.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n";
import {
	AuthInput,
	AuthLink,
	AuthMessage,
	AuthScreen,
	AuthSubmit,
} from "../components/auth-form";
import { emailFieldTraits } from "../components/credentials-model";
import { HoldWhileBusy } from "../components/hold-while-busy";
import { usePasswordReset } from "./use-password-reset";

export function ForgotPasswordScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ email?: string }>();
	const copy = useI18n().t.resetPassword;
	const { request, busy, error } = usePasswordReset();
	const [email, setEmail] = useState(params.email ?? "");
	// The screen holds while the request runs, but if it is gone anyway a late
	// success must not then push the code screen.
	const mounted = useRef(true);
	useEffect(
		() => () => {
			mounted.current = false;
		},
		[],
	);

	async function sendCode(typed: string = email) {
		const address = typed.trim();
		if (!address || busy) return;
		if ((await request(address)) && mounted.current) {
			router.push({ pathname: "/reset-password", params: { email: address } });
		}
	}

	return (
		<AuthScreen
			title={copy.title}
			subtitle={copy.subtitle}
			footer={
				<AuthLink
					label={copy.backToSignIn}
					onPress={router.back}
					disabled={busy}
				/>
			}
		>
			<HoldWhileBusy busy={busy} />
			<AuthInput
				placeholder={copy.email}
				value={email}
				onChangeText={setEmail}
				onEndEditing={(event) => setEmail(event.nativeEvent.text)}
				autoCapitalize="none"
				autoCorrect={false}
				keyboardType="email-address"
				{...emailFieldTraits}
				autoFocus={!params.email}
				returnKeyType="send"
				onSubmitEditing={(event) => void sendCode(event.nativeEvent.text)}
			/>

			<AuthMessage message={error} />

			<AuthSubmit
				label={copy.sendCode}
				busy={busy}
				disabled={!email.trim()}
				onPress={() => void sendCode()}
				testID="forgot-password-submit"
			/>
		</AuthScreen>
	);
}
