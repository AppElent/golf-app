import { useLocalSearchParams, useRouter } from "expo-router";
import { EmailCodeForm } from "../components/email-code-form";
import { useVerifyEmail } from "./use-verify-email";

/** The address param only says where the code went. */
export function VerifyEmailScreen() {
	const router = useRouter();
	const { email } = useLocalSearchParams<{ email?: string }>();
	const { verify, resend, resending, busy, notice, error } = useVerifyEmail();

	return (
		<EmailCodeForm
			email={email}
			busy={busy}
			error={error}
			notice={notice}
			onSubmit={verify}
			onResend={resend}
			resendDisabled={resending}
			onChangeEmail={() => router.back()}
		/>
	);
}
