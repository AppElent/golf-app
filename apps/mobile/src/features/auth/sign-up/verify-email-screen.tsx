import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { EmailCodeForm } from "../components/email-code-form";
import { useVerifyEmail } from "./use-verify-email";

/** Reached from sign-up with a code in flight; anything else starts over. */
export function VerifyEmailScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ email?: string }>();
	const { email, verify, resend, resending, busy, notice, error } =
		useVerifyEmail(params.email);

	// `busy` holds after a successful verify, while the sign-in takes over.
	if (email === null && !busy) return <Redirect href="/sign-up" />;

	return (
		<EmailCodeForm
			email={email ?? undefined}
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
