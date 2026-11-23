import { ACCOUNT_PORTAL_URL } from "@fairway/core/account-portal";
import { openBrowserAsync } from "expo-web-browser";
import { useI18n } from "../../../i18n";
import { InsetRow } from "../../../ui/inset-list";

/**
 * "Manage your AppElent account": the full account (connected sign-ins,
 * devices, two-factor, every app's data) lives in the central portal
 * (APP-667). The Profile tab keeps Fairway's own account rows beside it.
 */
export function AccountPortalRow() {
	const { t } = useI18n();
	return (
		<InsetRow
			leading={{ symbol: "person.crop.circle.badge.checkmark" }}
			title={t.account.managePortal}
			external
			onPress={() => {
				openBrowserAsync(ACCOUNT_PORTAL_URL).catch(() => {});
			}}
		/>
	);
}
