/**
 * The submit does not navigate: `finalize()` (in `usePasswordSignIn`) flips
 * `isSignedIn`, the `(auth)` layout redirects to `/`, and this screen unmounts.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { devLogin } from "../../../auth/config";
import { useI18n } from "../../../i18n";
import { AppText } from "../../../ui/text";
import {
	AuthLink,
	AuthMessage,
	AuthScreen,
	AuthSubmit,
} from "../components/auth-form";
import { CredentialsFields } from "../components/credentials-fields";
import { credentialsReady } from "../components/credentials-model";
import { SocialButtons } from "../components/social-buttons";
import { useCredentialsForm } from "../components/use-credentials-form";
import { emailToParam } from "./email-param";
import { useEmailCodeSignIn } from "./use-email-code-sign-in";
import { usePasswordSignIn } from "./use-password-sign-in";

export function SignInScreen() {
	const router = useRouter();
	const copy = useI18n().t.signIn;
	const { submit, busy, error } = usePasswordSignIn();
	const emailCode = useEmailCodeSignIn();
	const [codeHint, setCodeHint] = useState<string | null>(null);
	// AutoFill can change a field without `onChangeText`; submit its final text.
	const form = useCredentialsForm(
		{ email: devLogin?.email ?? "", password: devLogin?.password ?? "" },
		(latest) => {
			if (credentialsReady(latest) && !(busy || emailCode.busy))
				void submit(latest.email, latest.password);
		},
	);
	const { email } = form.values;

	async function sendCode() {
		setCodeHint(null);
		if (!email.trim()) {
			setCodeHint(copy.emailFirst);
			return;
		}
		if (await emailCode.send(email)) {
			router.push({
				pathname: "/sign-in-code",
				params: { email: emailToParam(email.trim()) },
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
			<CredentialsFields
				purpose="sign-in"
				emailLabel={copy.email}
				passwordLabel={copy.password}
				form={form}
			/>

			<AuthMessage message={codeHint ?? emailCode.error ?? error} />

			<AuthSubmit
				label={copy.submit}
				busy={busy || emailCode.busy}
				disabled={!(credentialsReady(form.values) || form.editing)}
				onPress={form.press}
				testID="sign-in-submit"
			/>

			<SocialButtons />
		</AuthScreen>
	);
}
