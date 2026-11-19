/**
 * The account's first and last name, saved to Clerk (`user.update`). Clerk is
 * the only copy: Convex keys data on the user id and stores no name.
 */
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useI18n } from "../../../i18n";
import { FormScreen, FormSection, FormTextField } from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { useToast } from "../../../ui/toast";
import { nameUpdate } from "./account-model";
import { useClerkWrite } from "./use-clerk-write";

export function NameScreen() {
	const { user } = useUser();
	const { t } = useI18n();
	const copy = t.account;
	const router = useRouter();
	const toast = useToast();
	const write = useClerkWrite();
	const [firstName, setFirstName] = useState(user?.firstName ?? "");
	const [lastName, setLastName] = useState(user?.lastName ?? "");
	const lastRef = useRef<TextInputInstance>(null);

	if (!user) return null;
	const account = user;

	function onSave() {
		void write.run(() => account.update(nameUpdate(firstName, lastName)), {
			onSuccess: () => {
				toast.success(copy.nameSaved);
				router.back();
			},
		});
	}

	return (
		<>
			<NavHeader
				title={copy.name}
				right={{
					label: t.common.save,
					onPress: onSave,
					disabled: write.pending,
				}}
			/>
			<FormScreen>
				<FormSection footer={copy.nameHint}>
					<FormTextField
						label={copy.firstName}
						value={firstName}
						onChangeText={setFirstName}
						autoComplete="given-name"
						textContentType="givenName"
						autoCapitalize="words"
						autoFocus
						returnKeyType="next"
						submitBehavior="submit"
						onSubmitEditing={() => lastRef.current?.focus()}
					/>
					<FormTextField
						ref={lastRef}
						label={copy.lastName}
						value={lastName}
						onChangeText={setLastName}
						autoComplete="family-name"
						textContentType="familyName"
						autoCapitalize="words"
						returnKeyType="done"
						onSubmitEditing={onSave}
						error={write.error ?? undefined}
					/>
				</FormSection>
			</FormScreen>
		</>
	);
}
