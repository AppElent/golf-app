import { useEffect, useRef, useState } from "react";
import { convexErrorMessage } from "./error-message";

/**
 * One mutation-backed submit: its pending state, its error, and two rules. One
 * submit runs at a time, whatever control started it. Nothing navigates once
 * the screen has gone: a slow mutation can resolve after the user left (Cancel
 * stays available while it is pending), and Convex still applies it, but
 * navigating then would pop an unrelated screen.
 *
 * Pending stays true after a success, because the screen is about to leave.
 */
export function useSubmit() {
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

	const run = (action: SubmitAction, options: SubmitOptions) =>
		runSubmit(
			action,
			{
				isOpen: () => open.current,
				isPending: () => pendingNow.current,
				setPending: (next) => {
					pendingNow.current = next;
					setPendingState(next);
				},
				setError,
			},
			options,
		);

	return { pending, error, setError, run };
}

/** `isOpen` lets a multi-step action stop once the screen has gone. */
type SubmitAction = (isOpen: () => boolean) => Promise<unknown>;

interface SubmitOptions {
	errorFallback: string;
	/** Skipped when the screen has gone; this is where navigation belongs. */
	onSuccess?: () => void;
	/** Replaces `error`, for a screen that reports failures another way. */
	onError?: (message: string) => void;
}

/** `useSubmit`'s rules, apart from the React state they write to. */
export async function runSubmit(
	action: SubmitAction,
	{
		isOpen,
		isPending,
		setPending,
		setError,
	}: {
		isOpen: () => boolean;
		isPending: () => boolean;
		setPending: (pending: boolean) => void;
		setError: (error: string | null) => void;
	},
	{ errorFallback, onSuccess, onError }: SubmitOptions,
) {
	if (isPending()) return;
	setPending(true);
	setError(null);
	try {
		await action(isOpen);
		if (isOpen()) onSuccess?.();
	} catch (e) {
		const message = convexErrorMessage(e, errorFallback);
		if (onError) onError(message);
		else setError(message);
		setPending(false);
	}
}
