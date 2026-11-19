/**
 * A new email address for the account: Clerk creates it unverified and emails
 * a code (`createEmailAddress`, then `prepareVerification`); the code step
 * replaces this screen, so Back from there returns to the list.
 */
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useI18n } from "../../../i18n";
import { FormScreen, FormSection, FormTextField } from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { useToast } from "../../../ui/toast";
import { thrownErrorKey } from "../../auth/clerk-errors";
import { useClerkWrite } from "./use-clerk-write";

export function AddEmailScreen() {
	const { user } = useUser();
	const { t } = useI18n();
	const copy = t.account;
	const router = useRouter();
	const toast = useToast();
	const write = useClerkWrite();
	const [email, setEmail] = useState("");

	if (!user) return null;

	function onContinue(typed: string = email) {
		const address = typed.trim();
		if (!address || !user) return;
		let id = "";
		void write.run(
			async () => {
				const created = await user.createEmailAddress({ email: address });
				id = created.id;
				await created.prepareVerification({ strategy: "email_code" });
			},
			{
				onSuccess: () =>
					router.replace({
						pathname: "/profile/verify-email",
						params: { id },
					}),
				// Created, but the code didn't go out: the code step can resend it.
				onError: (failure) => {
					const message = t.authErrors[thrownErrorKey(failure)];
					if (!id) return write.setError(message);
					toast.error(message);
					router.replace({ pathname: "/profile/verify-email", params: { id } });
				},
			},
		);
	}

	return (
		<>
			<NavHeader
				title={copy.addEmail}
				right={{
					label: copy.continue,
					onPress: () => onContinue(),
					disabled: write.pending || !email.trim(),
				}}
			/>
			<FormScreen>
				<FormSection footer={copy.addEmailHint}>
					<FormTextField
						label={copy.newEmail}
						value={email}
						onChangeText={(next) => {
							setEmail(next);
							write.setError(null);
						}}
						onEndEditing={(event) => setEmail(event.nativeEvent.text)}
						keyboardType="email-address"
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="email"
						textContentType="emailAddress"
						autoFocus
						returnKeyType="send"
						onSubmitEditing={(event) => onContinue(event.nativeEvent.text)}
						error={write.error ?? undefined}
					/>
				</FormSection>
			</FormScreen>
		</>
	);
}
