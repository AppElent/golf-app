import { useEffect, useState } from "react";

/**
 * "Delete Fairway data only" signs the golfer out and Clerk reloads the tab,
 * so the confirmation travels in this tab's sessionStorage and the sign-in
 * card shows it once.
 */
const KEY = "fairway.dataDeleted";

export function rememberDataDeleted() {
	try {
		window.sessionStorage.setItem(KEY, "1");
	} catch {
		// Storage blocked: the golfer still lands on the sign-in card.
	}
}

export function forgetDataDeleted() {
	try {
		window.sessionStorage.removeItem(KEY);
	} catch {
		// Storage blocked: nothing was remembered.
	}
}

/** Read once on the client: the flag is gone after the first render. */
export function DataDeletedNotice() {
	const [show, setShow] = useState(false);
	useEffect(() => {
		try {
			if (window.sessionStorage.getItem(KEY) === null) return;
			window.sessionStorage.removeItem(KEY);
			setShow(true);
		} catch {
			// Storage blocked: nothing to show.
		}
	}, []);
	if (!show) return null;
	return (
		<div
			role="status"
			className="w-full max-w-sm rounded-2xl border border-card-line bg-surface p-4"
		>
			<p className="text-label font-semibold text-ink">
				Your Fairway data is deleted
			</p>
			<p className="mt-1 text-label text-moss">
				Your AppElent login still works in Gather, Foundry and Arcade Club.
				Signing in here again starts a fresh, empty Fairway profile.
			</p>
		</div>
	);
}
