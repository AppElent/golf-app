import { useClerk, useReverification, useUser } from "@clerk/react";
import { deleteInBatches } from "@fairway/core/account-deletion";
import { useMutation } from "convex/react";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { CONTROL } from "../../components/classes";
import { Section } from "../../components/Page";
import { forgetDataDeleted, rememberDataDeleted } from "./data-deleted-notice";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;

/** What the golfer chose to delete. The login is shared by every AppElent
 *  app, so "app" keeps it and "account" deletes it everywhere. */
type Choice = "app" | "account";

type Step = "closed" | "choose" | Choice;

type Failure = "sign-out" | "data" | "account";

const FAILURE_TEXT: Record<Failure, string> = {
	"sign-out": "Couldn't sign out. Check your connection and try again.",
	data: "Couldn't finish deleting your Fairway data. Your login wasn't touched. Check your connection and try again.",
	account:
		"Your Fairway data was deleted, but your AppElent login wasn't. Try again to finish deleting it.",
};

const CONFIRM: Record<
	Choice,
	{ title: string; body: string; action: string; busy: string }
> = {
	app: {
		title: "Delete your Fairway data?",
		body: "Your rounds, scores, shots, clubs, settings, course copies and suggestions are deleted, and you're signed out here. Your AppElent login keeps working in Gather, Foundry and Arcade Club. This can't be undone.",
		action: "Delete Fairway data",
		busy: "Deleting…",
	},
	account: {
		title: "Delete your whole AppElent account?",
		body: "Your AppElent login is deleted, and with it your data in Gather, Foundry, Fairway and Arcade Club. You can't sign in to any of them with it again. This can't be undone.",
		action: "Delete AppElent account",
		busy: "Deleting…",
	},
};

/** Who is signed in, the web's sign-out (features.ts `sign-out`) and account
 *  deletion (`account-deletion`). Clerk ends the session and sends the tab to
 *  `afterSignOutUrl` (`/`), to `/profile` after "Fairway data only" (the
 *  public `/` has no sign-in card for the notice), or drops it when the user
 *  is deleted; on a protected path `AuthGate` then shows the sign-in card. */
export function AccountSection() {
	const { user } = useUser();
	const { signOut } = useClerk();
	const deleteMyData = useMutation(api.account.deleteMyData);
	// Clerk may ask the golfer to confirm who they are before it deletes them.
	const deleteUser = useReverification((u: ClerkUser) => u.delete());
	const [busy, setBusy] = useState<"signing-out" | "deleting" | null>(null);
	const [step, setStep] = useState<Step>("closed");
	const [failed, setFailed] = useState<Failure | null>(null);
	const email = user?.primaryEmailAddress?.emailAddress;

	const deleteButton = useRef<HTMLButtonElement>(null);
	const cancelButton = useRef<HTMLButtonElement>(null);
	const moveFocus = useRef(false);
	const titleId = useId();
	useEffect(() => {
		if (!moveFocus.current) return;
		moveFocus.current = false;
		(step === "closed" ? deleteButton : cancelButton).current?.focus();
	}, [step]);

	function goTo(next: Step) {
		moveFocus.current = true;
		setStep(next);
		setFailed(null);
	}

	async function onSignOut() {
		setBusy("signing-out");
		setFailed(null);
		try {
			await signOut();
		} catch {
			setFailed("sign-out");
			setBusy(null);
		}
	}

	async function onDelete(choice: Choice) {
		if (!user) return;
		setBusy("deleting");
		setFailed(null);
		// App data first, while the session can still authenticate with Convex,
		// batch by batch; a different signed-in account is refused.
		try {
			await deleteInBatches(() => deleteMyData({ expectedSubject: user.id }));
		} catch {
			// The login is untouched; a retry deletes what is left.
			setFailed("data");
			setBusy(null);
			return;
		}
		if (choice === "app") {
			// The shared login stays: no user.delete(), no Apple revocation.
			// The sign-in card says what happened (AuthGate). The public `/`
			// (APP-235) has no sign-in card, so land on this gated page instead.
			rememberDataDeleted();
			try {
				await signOut({ redirectUrl: "/profile" });
			} catch {
				// Data is gone; signing out is all that is left to retry.
				forgetDataDeleted();
				setFailed("sign-out");
				setBusy(null);
			}
			return;
		}
		try {
			await deleteUser(user);
		} catch {
			// Still signed in. A retry deletes no more data and tries Clerk again.
			setFailed("account");
			setBusy(null);
		}
	}

	const disabled = busy !== null;
	const optionClass = `w-full rounded-xl border ${CONTROL} px-4 py-3 text-left disabled:opacity-40`;

	return (
		<Section title="Account">
			{email ? (
				<p className="mb-3 text-label text-moss">
					Signed in as <span className="font-semibold text-ink">{email}</span>
				</p>
			) : null}
			<button
				type="button"
				disabled={disabled}
				onClick={onSignOut}
				className={`w-full rounded-xl border ${CONTROL} px-4 py-3 font-display text-callout font-semibold text-flag-ink disabled:opacity-40`}
			>
				{busy === "signing-out" ? "Signing out…" : "Sign out"}
			</button>
			{step === "choose" ? (
				<section
					aria-labelledby={titleId}
					className="mt-3 rounded-2xl border border-flag/40 bg-flag/5 p-4"
				>
					<p id={titleId} className="text-label font-semibold text-ink">
						What do you want to delete?
					</p>
					<p className="mt-1 text-label text-moss">
						Gather, Foundry, Fairway and Arcade Club share one AppElent login.
					</p>
					<div className="mt-3 flex flex-col gap-2">
						<button
							type="button"
							disabled={disabled}
							onClick={() => goTo("app")}
							className={optionClass}
						>
							<span className="block font-display text-callout font-semibold text-flag-ink">
								Delete Fairway data only
							</span>
							<span className="mt-0.5 block text-label text-moss">
								Your rounds, scores, clubs and course copies go. Your login
								stays, so your other AppElent apps keep working.
							</span>
						</button>
						<button
							type="button"
							disabled={disabled}
							onClick={() => goTo("account")}
							className={optionClass}
						>
							<span className="block font-display text-callout font-semibold text-flag-ink">
								Delete my whole AppElent account
							</span>
							<span className="mt-0.5 block text-label text-moss">
								Also deletes your login and your data in Gather, Foundry,
								Fairway and Arcade Club.
							</span>
						</button>
						<button
							ref={cancelButton}
							type="button"
							disabled={disabled}
							onClick={() => goTo("closed")}
							className="rounded-full border border-control-line px-4 py-3 font-display text-callout font-semibold text-ink disabled:opacity-40"
						>
							Cancel
						</button>
					</div>
				</section>
			) : step === "app" || step === "account" ? (
				<section
					aria-labelledby={titleId}
					className="mt-3 rounded-2xl border border-flag/40 bg-flag/5 p-4"
				>
					<p id={titleId} className="text-label font-semibold text-ink">
						{CONFIRM[step].title}
					</p>
					<p className="mt-1 text-label text-moss">{CONFIRM[step].body}</p>
					<div className="mt-3 flex gap-2">
						<button
							type="button"
							disabled={disabled}
							onClick={() => onDelete(step)}
							className="flex-1 rounded-full bg-flag px-4 py-3 font-display text-callout font-bold text-white disabled:opacity-40"
						>
							{busy === "deleting" ? CONFIRM[step].busy : CONFIRM[step].action}
						</button>
						<button
							ref={cancelButton}
							type="button"
							disabled={disabled}
							onClick={() => goTo("closed")}
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
					disabled={disabled || !user}
					onClick={() => goTo("choose")}
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
