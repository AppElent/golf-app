import { deleteInBatches } from "@fairway/core/account-deletion";

/**
 * What the golfer chose to delete. Every AppElent app (Gather, Foundry,
 * Fairway, Arcade Club) shares one Clerk login: "app" deletes Fairway's data
 * and keeps it, "account" deletes it, and the other apps wipe their data
 * through their Clerk `user.deleted` webhooks.
 */
export type DeletionChoice = "app" | "account";

/** `done`, or the step that failed; everything before it happened. */
export type DeletionResult = "done" | "data" | "sign-out" | "login";

export type DeletionSteps = {
	/** One `account.deleteMyData` batch for the signed-in Clerk user. */
	deleteBatch: () => Promise<{ done: boolean }>;
	/** Drop this phone's saved copy of the account (last-known cache). */
	clearLocalCopy: () => void;
	signOut: () => Promise<unknown>;
	/** Delete the Clerk user, the shared AppElent login. */
	deleteLogin: () => Promise<unknown>;
};

/**
 * Fairway's data first, while the session can still authenticate with Convex;
 * then the saved copy on this phone; then either sign out (the login stays)
 * or delete the login. A retry after a failure picks up where it stopped: a
 * finished purge is a no-op batch.
 */
export async function runAccountDeletion(
	choice: DeletionChoice,
	steps: DeletionSteps,
): Promise<DeletionResult> {
	try {
		await deleteInBatches(steps.deleteBatch);
	} catch {
		return "data";
	}
	steps.clearLocalCopy();
	if (choice === "app") {
		try {
			await steps.signOut();
		} catch {
			return "sign-out";
		}
		return "done";
	}
	try {
		await steps.deleteLogin();
	} catch {
		return "login";
	}
	return "done";
}
