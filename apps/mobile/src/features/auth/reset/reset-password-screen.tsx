/**
 * Second half of the password reset: the emailed code and the new password.
 * `forgot-password` already sent the code, so this screen never sends on mount
 * (Clerk rate-limits re-sends). A successful reset signs in; the `(auth)`
 * layout redirects and this screen unmounts.
 *
 * Password managers (auth standard, "Password managers"): the read-only email
 * above names the account, so iOS offers a strong password within Clerk's
 * policy and updates the saved entry instead of adding one. AutoFill and a
 * declined strong-password offer can change the field without `onChangeText`,
 * so `useCredentialsForm` also syncs from `onEndEditing` and submits the
 * field's final text.
 *
 * Resend and "Use a different email" stay disabled, and the screen cannot be
 * left, while any action runs: all act on the same Clerk attempt as sign-in.
 * After Clerk accepts the password the fields lock and the button only signs
 * in; when the account needs a second factor, the screen ends with a way back.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	AuthInput,
	AuthLink,
	AuthMessage,
	AuthScreen,
	AuthSubmit,
} from "../components/auth-form";
import {
	accountNameFieldTraits,
	newPasswordTraits,
} from "../components/credentials-model";
import { HoldWhileBusy } from "../components/hold-while-busy";
import { useCredentialsForm } from "../components/use-credentials-form";
import { emailFromParam } from "../sign-in/email-param";
import { RESET_CODE_LENGTH, resetReady } from "./reset-model";
import { usePasswordReset } from "./use-password-reset";

export function ResetPasswordScreen() {
	const router = useRouter();
	const email =
		emailFromParam(useLocalSearchParams<{ email?: string }>().email) ?? "";
	const copy = useI18n().t.resetPassword;
	const { reset, finish, stage, resend, startOver, busy, locked, error } =
		usePasswordReset();
	const entering = stage === "entering";
	const [notice, setNotice] = useState<string | null>(null);
	const passwordRef = useRef<TextInputInstance>(null);
	const form = useCredentialsForm({ code: "", password: "" }, (latest) => {
		if (locked) return;
		if (stage === "saved") void finish();
		else if (resetReady(stage, latest))
			void reset(latest.code, latest.password);
	});
	// "Use a different email" goes back once the start-over has released the
	// hold; an effect never runs after unmount, so a late one pops nothing.
	const [leaving, setLeaving] = useState(false);
	useEffect(() => {
		if (leaving && !locked) router.back();
	}, [leaving, locked, router]);

	async function onResend() {
		setNotice(null);
		if (await resend()) setNotice(copy.resent);
	}

	return (
		<AuthScreen
			title={copy.codeTitle}
			subtitle={fmt(copy.codeSubtitle, { email })}
			footer={
				entering ? (
					<>
						<AuthLink
							label={copy.resend}
							onPress={() => void onResend()}
							disabled={locked}
						/>
						<AuthLink
							label={copy.changeEmail}
							disabled={locked}
							onPress={async () => {
								if (await startOver()) setLeaving(true);
							}}
						/>
					</>
				) : stage === "needsWeb" ? (
					<AuthLink
						label={copy.backToSignIn}
						onPress={() => router.dismissTo("/sign-in")}
					/>
				) : null
			}
		>
			<HoldWhileBusy busy={locked} />
			<AuthInput
				placeholder={copy.email}
				value={email}
				{...accountNameFieldTraits}
			/>
			<AuthInput
				placeholder={copy.code}
				{...form.field("code")}
				keyboardType="number-pad"
				autoComplete="one-time-code"
				textContentType="oneTimeCode"
				maxLength={RESET_CODE_LENGTH}
				editable={entering}
				autoFocus
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => passwordRef.current?.focus()}
			/>
			<AuthInput
				ref={passwordRef}
				placeholder={copy.newPassword}
				{...form.field("password")}
				editable={entering}
				secureTextEntry
				autoCapitalize="none"
				{...newPasswordTraits}
				returnKeyType="go"
				onSubmitEditing={form.submitFrom("password")}
			/>

			<AuthMessage message={error} />
			<AuthMessage
				message={stage === "saved" ? copy.saved : notice}
				tone="muted"
			/>

			{stage === "needsWeb" ? null : (
				<AuthSubmit
					label={stage === "saved" ? copy.finishSignIn : copy.submit}
					busy={busy}
					disabled={
						locked ||
						(entering && !(resetReady(stage, form.values) || form.editing))
					}
					onPress={form.press}
					testID="reset-password-submit"
				/>
			)}
		</AuthScreen>
	);
}
