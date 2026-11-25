import { ACCOUNT_PORTAL_URL } from "@fairway/core/account-portal";
import { useI18n } from "../../../i18n";
import { InsetRow } from "../../../ui/inset-list";
import { openInBrowser } from "../open-in-browser";

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
			accessibilityHint={t.profile.opensInBrowser}
			onPress={() => {
				void openInBrowser(ACCOUNT_PORTAL_URL, {
					title: t.account.managePortal,
					message: t.profile.browserFailed,
				});
			}}
		/>
	);
}
