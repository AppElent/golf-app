import { useAuth, useUser } from "@clerk/expo";
import { useMutation } from "convex/react";
import { Stack } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { api } from "../../../convex/api";
import { clearLastKnown } from "../../../convex/last-known";
import { useI18n } from "../../../i18n";
import { metrics, spacing } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import {
	type DeletionChoice,
	runAccountDeletion,
} from "./account-deletion-model";

/**
 * Account deletion's choice step (Profile → Delete account): Fairway's data
 * only, keeping the shared AppElent login, or the whole AppElent account.
 * Each choice then asks once more in a system alert.
 */
export function DeleteAccountScreen() {
	const { t } = useI18n();
	const toast = useToast();
	const confirm = useConfirm();
	const { signOut } = useAuth();
	const { user } = useUser();
	const deleteMyData = useMutation(api.account.deleteMyData);
	const [deleting, setDeleting] = useState<DeletionChoice | null>(null);

	async function onDelete(choice: DeletionChoice) {
		if (!user) return;
		const app = choice === "app";
		const ok = await confirm({
			title: app ? t.profile.deleteAppTitle : t.profile.deleteWholeTitle,
			message: app ? t.profile.deleteAppMessage : t.profile.deleteWholeMessage,
			confirmLabel: app
				? t.profile.deleteAppConfirm
				: t.profile.deleteWholeConfirm,
			destructive: true,
		});
		if (!ok) return;
		setDeleting(choice);
		const result = await runAccountDeletion(choice, {
			deleteBatch: () => deleteMyData({ expectedSubject: user.id }),
			// The saved round copy and its account marker go with the data.
			clearLocalCopy: clearLastKnown,
			signOut: () => signOut(),
			deleteLogin: () => user.delete(),
		});
		if (result === "done") {
			// Signed out or deleted: the auth stack replaces this screen.
			if (app) {
				Alert.alert(
					t.profile.deleteAppDoneTitle,
					t.profile.deleteAppDoneMessage,
				);
			}
			return;
		}
		setDeleting(null);
		toast.error(
			result === "data"
				? t.profile.deleteError
				: result === "sign-out"
					? t.profile.deleteSignOutError
					: t.profile.deleteLoginError,
		);
	}

	const label = (choice: DeletionChoice, title: string) =>
		deleting === choice ? `${title}…` : title;

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			<Stack.Screen options={{ title: t.profile.deleteAccount }} />
			<AppText variant="footnote">{t.profile.deleteIntro}</AppText>
			<InsetList footer={t.profile.deleteAppOnlyHint}>
				<InsetRow
					leading={{ symbol: "trash" }}
					title={label("app", t.profile.deleteAppOnly)}
					destructive
					onPress={deleting ? undefined : () => void onDelete("app")}
				/>
			</InsetList>
			<InsetList footer={t.profile.deleteWholeHint}>
				<InsetRow
					leading={{ symbol: "person.crop.circle.badge.xmark" }}
					title={label("account", t.profile.deleteWhole)}
					destructive
					onPress={deleting ? undefined : () => void onDelete("account")}
				/>
			</InsetList>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: metrics.screenGutter,
		paddingBottom: spacing.xxl,
		gap: spacing.lg,
	},
});
