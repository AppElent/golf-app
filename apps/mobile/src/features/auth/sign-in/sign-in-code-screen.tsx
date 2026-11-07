import { useLocalSearchParams, useRouter } from "expo-router";
import { EmailCodeForm } from "../components/email-code-form";
import { useEmailCodeSignIn } from "./use-email-code-sign-in";

export function SignInCodeScreen() {
	const router = useRouter();
	const { email } = useLocalSearchParams<{ email?: string }>();
	const { verify, resend, resending, notice, startOver, busy, error } =
		useEmailCodeSignIn();

	return (
		<EmailCodeForm
			email={email}
			busy={busy}
			error={error}
			notice={notice}
			onSubmit={verify}
			onResend={resend}
			resendDisabled={resending}
			onChangeEmail={async () => {
				await startOver();
				router.back();
			}}
		/>
	);
}
