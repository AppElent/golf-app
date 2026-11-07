/**
 * One Clerk flow's shared bookkeeping: Core 3 calls resolve to `{ error }`
 * rather than throwing, so a flow is a run of calls that each stop it on an
 * error. What to show is still `pickError(errors, returned)`.
 */
import { useCallback, useRef, useState } from "react";
import type { CodedError } from "./clerk-errors";

/**
 * - `release`: not busy once the flow ends.
 * - `hold`: stays busy after a success, because `finalize()` flips `isSignedIn`
 *   and the `(auth)` layout unmounts the caller.
 * - `none`: leaves `busy` alone, for a resend with no spinner of its own.
 */
type BusyPolicy = "release" | "hold" | "none";

export function useClerkStep() {
	const [busy, setBusy] = useState(false);
	const [returned, setReturned] = useState<CodedError | null>(null);
	// State alone can't refuse a second tap before the next render.
	const busyNow = useRef(false);

	const clearReturned = useCallback(() => setReturned(null), []);

	const run = useCallback(
		async (
			/** `ok` records a call's error and says whether the flow can go on. */
			flow: (
				ok: (result: { error: CodedError | null }) => boolean,
			) => Promise<boolean>,
			policy: BusyPolicy = "release",
		): Promise<boolean> => {
			if (policy !== "none") {
				if (busyNow.current) return false;
				busyNow.current = true;
				setBusy(true);
			}
			setReturned(null);
			const succeeded = await flow((result) => {
				if (result.error) setReturned(result.error);
				return !result.error;
			});
			if (policy === "release" || (policy === "hold" && !succeeded)) {
				busyNow.current = false;
				setBusy(false);
			}
			return succeeded;
		},
		[],
	);

	return { busy, returned, clearReturned, run };
}
