import { useRouter } from "expo-router";
import { useState } from "react";
import { useI18n } from "../../../i18n";
import {
	AuthLink,
	AuthMessage,
	AuthScreen,
	AuthSubmit,
} from "../components/auth-form";
import { CredentialsFields } from "../components/credentials-fields";
import { credentialsReady } from "../components/credentials-model";
import { SocialButtons } from "../components/social-buttons";
import { usePasswordSignUp } from "./use-password-sign-up";

export function SignUpScreen() {
	const router = useRouter();
	const copy = useI18n().t.signUp;
	const signUp = usePasswordSignUp();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const ready = credentialsReady(email, password);

	/** `typed` is the password field's native text when the keyboard's Go submits. */
	async function submit(typed: string = password) {
		if (!credentialsReady(email, typed) || signUp.busy) return;
		if (await signUp.submit(email, typed)) {
			router.push({
				pathname: "/verify-email",
				params: { email: email.trim() },
			});
		}
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
			<CredentialsFields
				purpose="sign-up"
				emailLabel={copy.email}
				passwordLabel={copy.password}
				email={email}
				password={password}
				onEmailChange={setEmail}
				onPasswordChange={setPassword}
				onSubmit={submit}
			/>

			<AuthMessage message={signUp.error} />

			<AuthSubmit
				label={copy.submit}
				busy={signUp.busy}
				disabled={!ready}
				onPress={() => submit()}
			/>

			<SocialButtons />
		</AuthScreen>
	);
}
