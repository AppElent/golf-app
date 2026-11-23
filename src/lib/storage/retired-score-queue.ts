/** The web score queue's storage key: the plain key held the queue from before
 *  accounts were split (unclaimed), `:<userId>` one account's queue. */
const SCORE_QUEUE_KEY = "fairway.scoreQueue";

/** Storage the sweep needs; `window.localStorage` in the browser. */
export interface SweepableStorage {
	readonly length: number;
	key(index: number): string | null;
	removeItem(key: string): void;
}

/**
 * Remove every web score queue from this browser (APP-386).
 *
 * The web round screens that wrote and sent these queues were retired in
 * APP-235, so nothing reads them any more: their unsent scores can never be
 * sent, and on a shared machine they would otherwise linger, the unclaimed
 * queue even after its owner deleted their account. Scoring lives in the
 * Fairway app now. Returns how many queues were removed.
 */
export function forgetRetiredScoreQueues(storage: SweepableStorage): number {
	const keys: string[] = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (key === SCORE_QUEUE_KEY || key?.startsWith(`${SCORE_QUEUE_KEY}:`)) {
			keys.push(key);
		}
	}
	for (const key of keys) storage.removeItem(key);
	return keys.length;
}

/** The browser's sweep, once per page load; blocked storage holds no queue. */
export function forgetRetiredScoreQueuesHere(): void {
	try {
		forgetRetiredScoreQueues(window.localStorage);
	} catch {
		// Storage blocked or unavailable: there is no queue to forget.
	}
}
