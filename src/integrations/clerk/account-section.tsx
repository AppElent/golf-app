import { useClerk, useUser } from "@clerk/react";
import { useState } from "react";
import { CONTROL } from "../../components/classes";
import { Section } from "../../components/Page";
import { useSimulationMode } from "../../play/simulation";

/** Who is signed in, and the web's sign-out (features.ts `sign-out`). Clerk
 *  ends the session and sends the tab to `afterSignOutUrl`, where `AuthGate`
 *  shows the sign-in card. */
export function AccountSection() {
	const { user } = useUser();
	const { signOut } = useClerk();
	const { simulating, setSimulating } = useSimulationMode();
	const [signingOut, setSigningOut] = useState(false);
	const [failed, setFailed] = useState(false);
	const email = user?.primaryEmailAddress?.emailAddress;

	async function onSignOut() {
		setSigningOut(true);
		setFailed(false);
		// Simulation mode is per tab; the next account starts in its real round.
		// Off before Clerk navigates away, back on if this golfer stays.
		const wasSimulating = simulating;
		setSimulating(false);
		try {
			await signOut();
		} catch {
			setSimulating(wasSimulating);
			setFailed(true);
			setSigningOut(false);
		}
	}

	return (
		<Section title="Account">
			{email ? (
				<p className="mb-3 text-label text-moss">
					Signed in as <span className="font-semibold text-ink">{email}</span>
				</p>
			) : null}
			<button
				type="button"
				disabled={signingOut}
				onClick={onSignOut}
				className={`w-full rounded-xl border ${CONTROL} px-4 py-3 font-display text-callout font-semibold text-flag-ink disabled:opacity-40`}
			>
				{signingOut ? "Signing out…" : "Sign out"}
			</button>
			{failed ? (
				<p role="alert" className="mt-2 text-label font-semibold text-flag-ink">
					Couldn't sign out. Check your connection and try again.
				</p>
			) : null}
		</Section>
	);
}
