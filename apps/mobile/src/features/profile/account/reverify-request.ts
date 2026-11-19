/**
 * The one reverification prompt waiting for the Reverify screen: what
 * `useReverification`'s `onNeedsReverification` hands over (`complete` retries
 * the change, `cancel` drops it), parked here because a route can't take
 * functions as params. A newer request cancels an older one.
 */
/** Clerk's `SessionVerificationLevel`. */
export type ReverifyLevel = "first_factor" | "second_factor" | "multi_factor";

export interface ReverifyRequest {
	level: ReverifyLevel | undefined;
	complete: () => void;
	cancel: () => void;
}

let waiting: ReverifyRequest | null = null;

export function openReverify(request: ReverifyRequest) {
	waiting?.cancel();
	waiting = request;
}

/** The waiting request, once: the screen that takes it must settle it. */
export function takeReverify(): ReverifyRequest | null {
	const request = waiting;
	waiting = null;
	return request;
}
