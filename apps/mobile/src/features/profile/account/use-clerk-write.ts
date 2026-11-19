/**
 * One write to the signed-in Clerk user (`user.update`, `createEmailAddress`,
 * `updatePassword`, …): its pending state and the rules `useSubmit` keeps for
 * Convex writes. One write runs at a time, and nothing navigates once the
 * screen has gone. The `user` methods throw Clerk API errors, so a failure is
 * shown as the catalog message for its Clerk code (`thrownErrorKey`), or
 * handed to `onError` for a screen that sorts it by field.
 *
 * Clerk asks for reverification before sensitive changes (email addresses,
 * password) on a session that last verified more than 10 minutes ago. Each
 * write goes through `useReverification`: on that error it opens the
 * Reverify screen, and retries the write once the person has confirmed it's
 * them. Backing out of that screen cancels the write without an error.
 *
 * Pending stays true after a success that navigates away.
 */
import { useReverification } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n";
import {
	isReverifyCancelled,
	isReverifyHint,
	thrownErrorKey,
} from "../../auth/clerk-errors";
import { openReverify } from "./reverify-request";

/** Still needs reverification after the prompt: shown as Clerk's own error. */
const STILL_NEEDS_REVERIFY = {
	errors: [{ code: "session_reverification_required" }],
};

interface WriteOptions {
	/** Skipped when the screen has gone; this is where navigation belongs. */
	onSuccess?: () => void;
	/** Takes the failure instead of `error`, e.g. to sort it by field. */
	onError?: (failure: unknown) => void;
	/** Clears pending after a success, for a screen that stays. */
	stay?: boolean;
}

export function useClerkWrite() {
	const messages = useI18n().t.authErrors;
	const router = useRouter();
	const guarded = useReverification(
		(action: () => Promise<unknown>) => action(),
		{
			onNeedsReverification: (request) => {
				openReverify(request);
				router.push("/profile/reverify");
			},
		},
	);
	const open = useRef(true);
	useEffect(() => {
		open.current = true;
		return () => {
			open.current = false;
		};
	}, []);
	const [pending, setPendingState] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// State alone can't refuse a second tap before the next render.
	const pendingNow = useRef(false);
	const setPending = (next: boolean) => {
		pendingNow.current = next;
		setPendingState(next);
	};

	async function run(
		action: () => Promise<unknown>,
		{ onSuccess, onError, stay = false }: WriteOptions = {},
	): Promise<boolean> {
		if (pendingNow.current) return false;
		setPending(true);
		setError(null);
		try {
			const result = await guarded(action);
			if (isReverifyHint(result)) throw STILL_NEEDS_REVERIFY;
		} catch (failure) {
			if (isReverifyCancelled(failure)) {
				setPending(false);
				return false;
			}
			if (__DEV__) console.warn("[account] Clerk write failed", failure);
			if (onError) onError(failure);
			else setError(messages[thrownErrorKey(failure)]);
			setPending(false);
			return false;
		}
		if (stay) setPending(false);
		if (open.current) onSuccess?.();
		return true;
	}

	return { pending, error, setError, run, isOpen: () => open.current };
}
