import { useClerk, useReverification, useUser } from "@clerk/react";
import { useMutation } from "convex/react";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { CONTROL } from "../../components/classes";
import { Section } from "../../components/Page";
import { forgetAccountQueue } from "../../offline/scoreQueue";
import { useSimulationMode } from "../../play/simulation";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;

type Failure = "sign-out" | "data" | "account";

const FAILURE_TEXT: Record<Failure, string> = {
	"sign-out": "Couldn't sign out. Check your connection and try again.",
	data: "Couldn't delete your account. Nothing was deleted. Check your connection and try again.",
	account:
		"Your data was deleted, but your sign-in wasn't. Try again to finish deleting your account.",
};

/** Who is signed in, the web's sign-out (features.ts `sign-out`) and account
 *  deletion (`account-deletion`). Clerk ends the session and sends the tab to
 *  `afterSignOutUrl`, or drops it when the user is deleted; either way
 *  `AuthGate` then shows the sign-in card. */
export function AccountSection() {
	const { user } = useUser();
	const { signOut } = useClerk();
	const { simulating, setSimulating } = useSimulationMode();
	const deleteMyData = useMutation(api.account.deleteMyData);
	// Clerk may ask the golfer to confirm who they are before it deletes them.
	const deleteUser = useReverification((u: ClerkUser) => u.delete());
	const [busy, setBusy] = useState<"signing-out" | "deleting" | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [failed, setFailed] = useState<Failure | null>(null);
	const email = user?.primaryEmailAddress?.emailAddress;

	const deleteButton = useRef<HTMLButtonElement>(null);
	const cancelButton = useRef<HTMLButtonElement>(null);
	const moveFocus = useRef(false);
	const titleId = useId();
	useEffect(() => {
		if (!moveFocus.current) return;
		moveFocus.current = false;
		(confirming ? cancelButton : deleteButton).current?.focus();
	}, [confirming]);

	function openConfirm(open: boolean) {
		moveFocus.current = true;
		setConfirming(open);
		setFailed(null);
	}

	async function onSignOut() {
		setBusy("signing-out");
		setFailed(null);
		// Simulation mode is per tab; the next account starts in its real round.
		// Off before Clerk navigates away, back on if this golfer stays.
		const wasSimulating = simulating;
		setSimulating(false);
		try {
			await signOut();
		} catch {
			setSimulating(wasSimulating);
			setFailed("sign-out");
			setBusy(null);
		}
	}

	async function onDelete() {
		if (!user) return;
		setBusy("deleting");
		setFailed(null);
		const wasSimulating = simulating;
		setSimulating(false);
		// App data first, while the session can still authenticate with Convex.
		try {
			await deleteMyData({});
		} catch {
			// One mutation: it deleted all of it or nothing.
			setSimulating(wasSimulating);
			setFailed("data");
			setBusy(null);
			return;
		}
		// Unsent scores belonged to rounds that are gone now.
		try {
			forgetAccountQueue(window.localStorage, user.id);
		} catch {
			// Storage blocked: there was no queue to forget.
		}
		try {
			await deleteUser(user);
		} catch {
			// Still signed in. A retry deletes no more data and tries Clerk again.
			// Simulation mode stays off: the simulated round went with the data.
			setFailed("account");
			setBusy(null);
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
				disabled={busy !== null}
				onClick={onSignOut}
				className={`w-full rounded-xl border ${CONTROL} px-4 py-3 font-display text-callout font-semibold text-flag-ink disabled:opacity-40`}
			>
				{busy === "signing-out" ? "Signing out…" : "Sign out"}
			</button>
			{confirming ? (
				<section
					aria-labelledby={titleId}
					className="mt-3 rounded-2xl border border-flag/40 bg-flag/5 p-4"
				>
					<p id={titleId} className="text-label font-semibold text-ink">
						Delete your account?
					</p>
					<p className="mt-1 text-label text-moss">
						Your rounds, scores, shots, clubs, settings, course copies and
						suggestions are deleted, and you're signed out. This can't be
						undone.
					</p>
					<div className="mt-3 flex gap-2">
						<button
							type="button"
							disabled={busy !== null}
							onClick={onDelete}
							className="flex-1 rounded-full bg-flag px-4 py-3 font-display text-callout font-bold text-white disabled:opacity-40"
						>
							{busy === "deleting" ? "Deleting…" : "Delete account"}
						</button>
						<button
							ref={cancelButton}
							type="button"
							disabled={busy !== null}
							onClick={() => openConfirm(false)}
							className="rounded-full border border-control-line px-4 py-3 font-display text-callout font-semibold text-ink disabled:opacity-40"
						>
							Cancel
						</button>
					</div>
				</section>
			) : (
				<button
					ref={deleteButton}
					type="button"
					disabled={busy !== null || !user}
					onClick={() => openConfirm(true)}
					className={`mt-3 w-full rounded-xl border ${CONTROL} px-4 py-3 font-display text-callout font-semibold text-flag-ink disabled:opacity-40`}
				>
					Delete account…
				</button>
			)}
			{failed ? (
				<p role="alert" className="mt-2 text-label font-semibold text-flag-ink">
					{FAILURE_TEXT[failed]}
				</p>
			) : null}
		</Section>
	);
}
