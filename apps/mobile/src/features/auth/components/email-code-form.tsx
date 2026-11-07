/**
 * The code half of an emailed-code flow, shared by passwordless sign-in and
 * sign-up verification. The flow has already sent the code: sending from a
 * mount would re-send on every remount, and Clerk rate-limits that.
 */
import { useState } from "react";
import { fmt, useI18n } from "../../../i18n";
import {
	AuthInput,
	AuthLink,
	AuthMessage,
	AuthScreen,
	AuthSubmit,
} from "./auth-form";

const CODE_LENGTH = 6;

export function EmailCodeForm({
	email,
	busy,
	error,
	notice,
	onSubmit,
	onResend,
	resendDisabled,
	onChangeEmail,
}: {
	email: string | undefined;
	busy: boolean;
	error: string | null;
	notice: string | null;
	onSubmit: (code: string) => void;
	onResend: () => void;
	resendDisabled: boolean;
	onChangeEmail: () => void;
}) {
	const copy = useI18n().t.verifyEmail;
	const [code, setCode] = useState("");
	const ready = code.length === CODE_LENGTH;

	return (
		<AuthScreen
			title={copy.title}
			subtitle={fmt(copy.subtitle, { email: email ?? "" })}
			footer={
				<>
					<AuthLink
						label={copy.resend}
						onPress={onResend}
						disabled={resendDisabled}
					/>
					<AuthLink label={copy.changeEmail} onPress={onChangeEmail} />
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
				onSubmitEditing={() => {
					if (ready && !busy) onSubmit(code);
				}}
			/>

			<AuthMessage message={error} />
			<AuthMessage message={notice} tone="muted" />

			<AuthSubmit
				label={copy.submit}
				busy={busy}
				disabled={!ready}
				onPress={() => onSubmit(code)}
			/>
		</AuthScreen>
	);
}
