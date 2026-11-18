import { useRouter } from "expo-router";
import { useI18n } from "../../../i18n";
import {
	AuthLink,
	AuthMessage,
	AuthScreen,
	AuthSubmit,
} from "../components/auth-form";
import { CredentialsFields } from "../components/credentials-fields";
import {
	type Credentials,
	credentialsReady,
} from "../components/credentials-model";
import { SocialButtons } from "../components/social-buttons";
import { useCredentialsForm } from "../components/use-credentials-form";
import { usePasswordSignUp } from "./use-password-sign-up";

export function SignUpScreen() {
	const router = useRouter();
	const copy = useI18n().t.signUp;
	const signUp = usePasswordSignUp();
	async function submit(latest: Credentials) {
		if (!credentialsReady(latest) || signUp.busy) return;
		if (await signUp.submit(latest.email, latest.password)) {
			router.push({
				pathname: "/verify-email",
				params: { email: latest.email.trim() },
			});
		}
	}
	// AutoFill can change a field without `onChangeText`; submit its final text.
	const form = useCredentialsForm({ email: "", password: "" }, (latest) => {
		void submit(latest);
	});

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
				form={form}
			/>

			<AuthMessage message={signUp.error} />

			<AuthSubmit
				label={copy.submit}
				busy={signUp.busy}
				disabled={!(credentialsReady(form.values) || form.editing)}
				onPress={form.press}
			/>

			<SocialButtons />
		</AuthScreen>
	);
}
