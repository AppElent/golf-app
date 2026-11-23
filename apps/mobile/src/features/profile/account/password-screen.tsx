/**
 * Change the account's password, or set one for an account made with Apple,
 * Google, Microsoft or an email code (no current password to ask for). Clerk
 * `user.updatePassword`; "Sign out other devices" passes
 * `signOutOfOtherSessions`.
 *
 * Its own pushed screen, by the auth standard ("Password managers"): iOS
 * AutoFill needs the read-only username (the primary email) above the
 * password fields to tell the current password from the new one; inline, it
 * reads both as new and clears both, without `onChangeText`, when its "Use
 * Strong Password?" offer is declined. `useCredentialsForm` also syncs each
 * field from `onEndEditing` and submits the focused field's final text.
 *
 * Each Clerk error entry goes to the field its `meta.paramName` names
 * (`passwordErrors`); the rest shows as a toast. No field takes focus on
 * open, so "Sign out other devices" is in view before the keyboard is.
 */
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useI18n } from "../../../i18n";
import {
	FormScreen,
	FormSection,
	FormSwitchRow,
	FormTextField,
} from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { useToast } from "../../../ui/toast";
import type { AuthErrorKey } from "../../auth/clerk-errors";
import {
	accountNameFieldTraits,
	currentPasswordTraits,
	newPasswordTraits,
} from "../../auth/components/credentials-model";
import { useCredentialsForm } from "../../auth/components/use-credentials-form";
import {
	type PasswordField,
	type PasswordValues,
	passwordErrors,
	passwordMode,
	passwordReady,
} from "./account-model";
import { useClerkWrite } from "./use-clerk-write";

export function PasswordScreen() {
	const { user } = useUser();
	const { t } = useI18n();
	const copy = t.account;
	const router = useRouter();
	const toast = useToast();
	const write = useClerkWrite();
	// Fixed for this visit: setting a password flips `passwordEnabled` just
	// before the screen leaves.
	const [mode] = useState(() => passwordMode(user?.passwordEnabled ?? false));
	const [signOutOthers, setSignOutOthers] = useState(true);
	const [fieldErrors, setFieldErrors] = useState<
		Partial<Record<PasswordField, AuthErrorKey>>
	>({});
	const nextRef = useRef<TextInputInstance>(null);
	const form = useCredentialsForm<PasswordField>(
		{ current: "", next: "" },
		(latest) => submit(latest),
	);

	if (!user) return null;
	const title = mode === "change" ? copy.changePassword : copy.setPassword;

	function submit(latest: PasswordValues) {
		if (!user || !passwordReady(mode, latest)) return;
		setFieldErrors({});
		void write.run(
			() =>
				user.updatePassword({
					newPassword: latest.next,
					...(mode === "change" ? { currentPassword: latest.current } : {}),
					signOutOfOtherSessions: signOutOthers,
				}),
			{
				onError: (failure) => {
					const { fields, form: formError } = passwordErrors(failure);
					setFieldErrors(fields);
					if (formError) toast.error(t.authErrors[formError]);
				},
				onSuccess: () => {
					toast.success(
						mode === "change" ? copy.passwordChanged : copy.passwordAdded,
					);
					router.back();
				},
			},
		);
	}

	const errorFor = (field: PasswordField) => {
		const key = fieldErrors[field];
		return key ? t.authErrors[key] : undefined;
	};

	const fields = [
		<FormTextField
			key="email"
			label={copy.email}
			value={user.primaryEmailAddress?.emailAddress ?? ""}
			{...accountNameFieldTraits}
		/>,
		mode === "change" ? (
			<FormTextField
				key="current"
				label={copy.currentPassword}
				{...form.field("current")}
				error={errorFor("current")}
				secureTextEntry
				autoCapitalize="none"
				{...currentPasswordTraits}
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => nextRef.current?.focus()}
			/>
		) : null,
		<FormTextField
			key="next"
			ref={nextRef}
			label={copy.newPassword}
			{...form.field("next")}
			error={errorFor("next")}
			secureTextEntry
			autoCapitalize="none"
			{...newPasswordTraits}
			returnKeyType="go"
			onSubmitEditing={form.submitFrom("next")}
		/>,
	].filter((field) => field !== null);

	return (
		<>
			<NavHeader
				title={title}
				right={{
					label: t.common.save,
					onPress: form.press,
					disabled:
						write.pending ||
						!(passwordReady(mode, form.values) || form.editing),
				}}
			/>
			<FormScreen>
				<FormSection
					footer={mode === "change" ? copy.passwordHint : copy.setPasswordHint}
				>
					{fields}
				</FormSection>
				<FormSection footer={copy.signOutOthersHint}>
					<FormSwitchRow
						label={copy.signOutOthers}
						value={signOutOthers}
						onValueChange={setSignOutOthers}
						disabled={write.pending}
					/>
				</FormSection>
			</FormScreen>
		</>
	);
}
