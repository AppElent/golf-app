/**
 * The account's email addresses (Clerk). The primary one, which people sign in
 * with, comes first; a tap on another opens its actions as an action sheet, and
 * the same actions sit behind a swipe and a long press. Changing the sign-in
 * email is: add the new address, verify it with the emailed code, make it
 * primary, remove the old one; the code step offers the last two in turn.
 */
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import {
	ActionSheetIOS,
	Alert,
	Platform,
	ScrollView,
	StyleSheet,
} from "react-native";
import { useI18n } from "../../../i18n";
import { metrics, spacing } from "../../../theme";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import type { RowAction } from "../../../ui/inset-list.shared";
import { NavHeader } from "../../../ui/nav-header";
import { type EmailRow, emailRows } from "./account-model";
import { useEmailActions } from "./use-email-actions";

export function EmailsScreen() {
	const { user } = useUser();
	const { t } = useI18n();
	const copy = t.account;
	const router = useRouter();
	const actions = useEmailActions();

	if (!user) return null;
	const rows = emailRows(user.emailAddresses, user.primaryEmailAddressId);

	function rowActions(row: EmailRow): RowAction[] {
		const list: RowAction[] = [];
		if (row.canVerify)
			list.push({
				key: "verify",
				label: copy.verifyAction,
				systemImage: "checkmark.seal",
				onPress: () => void actions.verify(row.id),
			});
		if (row.canMakePrimary)
			list.push({
				key: "primary",
				label: copy.makePrimary,
				systemImage: "star",
				onPress: () => void actions.makePrimary(row.id),
			});
		if (row.canRemove)
			list.push({
				key: "remove",
				label: copy.remove,
				systemImage: "trash",
				destructive: true,
				onPress: () => void actions.remove(row.id),
			});
		return list;
	}

	/** The visible way to every row action: a native action sheet. */
	function openSheet(row: EmailRow, list: RowAction[]) {
		if (Platform.OS === "ios") {
			const destructive = list.findIndex((action) => action.destructive);
			ActionSheetIOS.showActionSheetWithOptions(
				{
					title: row.email,
					options: [...list.map((action) => action.label), t.common.cancel],
					cancelButtonIndex: list.length,
					...(destructive >= 0 ? { destructiveButtonIndex: destructive } : {}),
				},
				(index) => list[index]?.onPress(),
			);
			return;
		}
		Alert.alert(row.email, undefined, [
			...list.map((action) => ({
				text: action.label,
				style: action.destructive ? ("destructive" as const) : undefined,
				onPress: action.onPress,
			})),
			{ text: t.common.cancel, style: "cancel" },
		]);
	}

	return (
		<>
			<NavHeader title={copy.email} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={styles.content}
			>
				<InsetList header={copy.emails} footer={copy.emailsHint}>
					{rows.map((row) => {
						const list = rowActions(row);
						return (
							<InsetRow
								key={row.id}
								leading={{
									symbol:
										row.status === "primary" ? "envelope.fill" : "envelope",
								}}
								title={row.email}
								secondary={
									row.status === "primary"
										? copy.primary
										: row.status === "unverified"
											? copy.unverified
											: undefined
								}
								actions={list}
								onPress={
									list.length > 0 && !actions.pending
										? () => openSheet(row, list)
										: undefined
								}
							/>
						);
					})}
				</InsetList>
				<InsetList>
					<InsetRow
						leading={{ symbol: "plus" }}
						title={copy.addEmail}
						onPress={() => router.push("/profile/add-email")}
					/>
				</InsetList>
			</ScrollView>
		</>
	);
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: metrics.screenGutter,
		paddingBottom: spacing.xxl,
		gap: spacing.lg,
	},
});
