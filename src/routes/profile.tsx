import { createFileRoute, Link } from "@tanstack/react-router";
import { DataExportSection } from "../components/DataExportSection";
import { Page, PageTitle } from "../components/Page";
import { AccountSection } from "../integrations/clerk/account-section";

export const Route = createFileRoute("/profile")({ component: AccountScreen });

/** The web's account floor (ADR 0001): data export, sign-out and account
 *  deletion. Handicap, clubs, units and the simulator are in the phone app. */
function AccountScreen() {
	return (
		<Page>
			<PageTitle>Account</PageTitle>
			<p className="mt-1 text-label text-moss">
				Your handicap, clubs and settings are in the{" "}
				<Link to="/" className="font-semibold underline">
					Fairway app
				</Link>
				.
			</p>

			<DataExportSection />

			<AccountSection />
		</Page>
	);
}
