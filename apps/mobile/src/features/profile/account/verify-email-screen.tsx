/**
 * The emailed code for a new address (`attemptVerification`). Once verified it
 * offers, in turn, to make the address primary and to remove the old primary
 * (`useEmailActions`), then returns to the list. The code was sent by the
 * screen before (add, or "Verify" on the list): never on mount, because Clerk
 * rate-limits re-sends.
 */
import { useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { fmt, useI18n } from "../../../i18n";
import {
	FormScreen,
	FormSection,
	FormTextField,
	TextAction,
} from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { useToast } from "../../../ui/toast";
import { EMAIL_CODE_LENGTH } from "./account-model";
import { useClerkWrite } from "./use-clerk-write";
import { useEmailActions } from "./use-email-actions";

export function VerifyEmailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { user } = useUser();
	const { t } = useI18n();
	const copy = t.account;
	const router = useRouter();
	const toast = useToast();
	const write = useClerkWrite();
	const resend = useClerkWrite();
	const actions = useEmailActions();
	const [code, setCode] = useState("");

	const address = user?.emailAddresses.find((a) => a.id === id);
	if (!user || !address) return null;
	const email = address.emailAddress;
	const ready = code.trim().length === EMAIL_CODE_LENGTH;

	function onVerify(typed: string = code) {
		if (typed.trim().length !== EMAIL_CODE_LENGTH || !address) return;
		void write.run(() => address.attemptVerification({ code: typed.trim() }), {
			onSuccess: async () => {
				toast.success(fmt(copy.verified, { email }));
				await actions.makePrimary(address.id);
				if (write.isOpen()) router.back();
			},
		});
	}

	return (
		<>
			<NavHeader
				title={copy.verifyTitle}
				right={{
					label: copy.verify,
					onPress: () => onVerify(),
					disabled: write.pending || !ready,
				}}
			/>
			<FormScreen>
				<FormSection footer={fmt(copy.verifyHint, { email })}>
					<FormTextField
						label={copy.code}
						value={code}
						onChangeText={(next) => {
							setCode(next);
							write.setError(null);
						}}
						keyboardType="number-pad"
						autoComplete="one-time-code"
						textContentType="oneTimeCode"
						maxLength={EMAIL_CODE_LENGTH}
						autoFocus
						returnKeyType="done"
						onSubmitEditing={(event) => onVerify(event.nativeEvent.text)}
						error={write.error ?? resend.error ?? undefined}
					/>
				</FormSection>
				<TextAction
					label={copy.resend}
					onPress={() =>
						void resend.run(
							() => address.prepareVerification({ strategy: "email_code" }),
							{ stay: true, onSuccess: () => toast.success(copy.resent) },
						)
					}
				/>
			</FormScreen>
		</>
	);
}
