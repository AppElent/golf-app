/**
 * One write to the signed-in Clerk user (`user.update`, `createEmailAddress`,
 * `updatePassword`, …): its pending state and the rules `useSubmit` keeps for
 * Convex writes. One write runs at a time, and nothing navigates once the
 * screen has gone. The `user` methods throw Clerk API errors, so a failure is
 * shown as the catalog message for its Clerk code (`thrownErrorKey`), or
 * handed to `onError` for a screen that sorts it by field.
 *
 * Pending stays true after a success that navigates away.
 */
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../i18n";
import { thrownErrorKey } from "../../auth/clerk-errors";

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
			await action();
		} catch (failure) {
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
