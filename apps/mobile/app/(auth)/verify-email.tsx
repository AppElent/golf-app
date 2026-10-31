/**
 * The 6-digit code that proves the address belongs to the person signing up.
 *
 * The address arrives as a route param only so the screen can say it back —
 * "we sent a code to *this*" is what sends someone to the right inbox. The
 * sign-up itself lives on Clerk's `signUp` resource, which survives the
 * navigation, so nothing functional depends on the param.
 *
 * As with sign-in, `finalize()` is what turns a complete sign-up into a
 * session; the `(auth)` layout then redirects and this screen unmounts.
 */
import { useSignUp } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import {
	AuthInput,
	AuthLink,
	AuthMessage,
	AuthScreen,
	AuthSubmit,
} from "../../src/auth/auth-form";
import { type CodedError, pickError } from "../../src/auth/clerk-errors";
import { fmt, useI18n } from "../../src/i18n";

const CODE_LENGTH = 6;

export default function VerifyEmail() {
	const router = useRouter();
	const copy = useI18n().t.verifyEmail;
	const { signUp, errors } = useSignUp();
	const { email } = useLocalSearchParams<{ email?: string }>();
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [returned, setReturned] = useState<CodedError | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const ready = code.length === CODE_LENGTH;
	const error = pickError(errors, returned);

	async function submit() {
		setBusy(true);
		setReturned(null);
		setNotice(null);

		const verified = await signUp.verifications.verifyEmailCode({ code });
		if (verified.error) {
			setReturned(verified.error);
			setBusy(false);
			return;
		}

		const finalized = await signUp.finalize();
		if (finalized.error) {
			setReturned(finalized.error);
			setBusy(false);
		}
	}

	async function resend() {
		setReturned(null);
		setNotice(null);
		const sent = await signUp.verifications.sendEmailCode();
		if (sent.error) {
			setReturned(sent.error);
			return;
		}
		setNotice(copy.resent);
	}

	return (
		<AuthScreen
			title={copy.title}
			subtitle={fmt(copy.subtitle, { email: email ?? "" })}
			footer={
				<>
					<AuthLink label={copy.resend} onPress={resend} />
					<AuthLink label={copy.changeEmail} onPress={() => router.back()} />
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
				onSubmitEditing={() => ready && !busy && submit()}
			/>

			<AuthMessage message={error} />
			<AuthMessage message={notice} tone="muted" />

			<AuthSubmit
				label={copy.submit}
				busy={busy}
				disabled={!ready}
				onPress={submit}
			/>
		</AuthScreen>
	);
}
