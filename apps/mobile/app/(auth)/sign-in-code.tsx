/**
 * The code half of passwordless sign-in. `sign-in` already sent it, so this
 * screen never sends on mount (a remount would re-send, and Clerk rate-limits
 * that). The address param is only there to say where the code went.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import {
	AuthInput,
	AuthLink,
	AuthMessage,
	AuthScreen,
	AuthSubmit,
} from "../../src/auth/auth-form";
import { useEmailCodeSignIn } from "../../src/auth/use-email-code-sign-in";
import { fmt, useI18n } from "../../src/i18n";

const CODE_LENGTH = 6;

export default function SignInCode() {
	const router = useRouter();
	const copy = useI18n().t.verifyEmail;
	const { email } = useLocalSearchParams<{ email?: string }>();
	const { verify, resend, resending, startOver, busy, error } =
		useEmailCodeSignIn();
	const [code, setCode] = useState("");
	const [notice, setNotice] = useState<string | null>(null);

	const ready = code.length === CODE_LENGTH;

	async function onResend() {
		setNotice(null);
		if (await resend()) setNotice(copy.resent);
	}

	return (
		<AuthScreen
			title={copy.title}
			subtitle={fmt(copy.subtitle, { email: email ?? "" })}
			footer={
				<>
					<AuthLink
						label={copy.resend}
						onPress={onResend}
						disabled={resending}
					/>
					<AuthLink
						label={copy.changeEmail}
						onPress={async () => {
							await startOver();
							router.back();
						}}
					/>
				</>
			}
		>
			<AuthInput
				placeholder={copy.code}
				value={code}
				onChangeText={setCode}
				keyboardType="number-pad"
				autoComplete="one-time-code"
				textContentType="oneTimeCode"
				maxLength={CODE_LENGTH}
				autoFocus
				returnKeyType="go"
				onSubmitEditing={() => ready && !busy && verify(code)}
			/>

			<AuthMessage message={error} />
			<AuthMessage message={notice} tone="muted" />

			<AuthSubmit
				label={copy.submit}
				busy={busy}
				disabled={!ready}
				onPress={() => verify(code)}
			/>
		</AuthScreen>
	);
}
