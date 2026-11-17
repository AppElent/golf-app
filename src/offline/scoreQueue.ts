import type { ScoreUpdate } from "@fairway/core/round";

export interface ScoreEntry {
	roundId: string;
	holeIndex: number;
	playerIndex: number;
	fields: ScoreUpdate;
}

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

const QUEUE_KEY = "fairway.scoreQueue";

/**
 * The queue of one signed-in account, so a golfer who signs in after another
 * on this browser neither sends nor sees the first one's unsent scores.
 *
 * The plain storage holds the queue from before accounts were split (and from
 * a tab still on that code). It is unclaimed: nothing on this device says
 * whose it is, so it is never moved into an account. A flush may still try its
 * entries; Convex accepts only the owner's (`requireOwnRound`), which then
 * leave it. Retire it once those entries can no longer exist.
 */
export function accountQueue(
	storage: StorageLike,
	userId: string,
): StorageLike {
	const own = `${QUEUE_KEY}:${userId}`;
	const scoped = (key: string) => (key === QUEUE_KEY ? own : key);
	return {
		getItem: (key) => storage.getItem(scoped(key)),
		setItem: (key, value) => storage.setItem(scoped(key), value),
	};
}

export function keyFor(
	roundId: string,
	holeIndex: number,
	playerIndex: number,
): string {
	return `${roundId}:${holeIndex}:${playerIndex}`;
}

export function keyOf(entry: ScoreEntry): string {
	return keyFor(entry.roundId, entry.holeIndex, entry.playerIndex);
}

export function readQueue(storage: StorageLike): ScoreEntry[] {
	const raw = storage.getItem(QUEUE_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as ScoreEntry[]) : [];
	} catch {
		return [];
	}
}

function writeQueue(storage: StorageLike, entries: ScoreEntry[]): void {
	storage.setItem(QUEUE_KEY, JSON.stringify(entries));
}

export function enqueueScore(storage: StorageLike, entry: ScoreEntry): void {
	const queue = readQueue(storage);
	const key = keyOf(entry);
	const existing = queue.find((e) => keyOf(e) === key);
	if (existing) {
		existing.fields = { ...existing.fields, ...entry.fields };
	} else {
		queue.push(entry);
	}
	writeQueue(storage, queue);
}

/** Drop a sent entry, unless it was edited while on its way to the server. */
export function removeSent(storage: StorageLike, sent: ScoreEntry): void {
	const fields = JSON.stringify(sent.fields);
	writeQueue(
		storage,
		readQueue(storage).filter(
			(e) => keyOf(e) !== keyOf(sent) || JSON.stringify(e.fields) !== fields,
		),
	);
}

/**
 * Forget the fields a newer, sent edit of the same hole and player replaced,
 * so an older queued edit of them can never land after it. An entry left with
 * no fields goes.
 */
export function dropSuperseded(storage: StorageLike, sent: ScoreEntry): void {
	const key = keyOf(sent);
	const queue = readQueue(storage);
	if (!queue.some((e) => keyOf(e) === key)) return;
	const kept: ScoreEntry[] = [];
	for (const e of queue) {
		if (keyOf(e) !== key) {
			kept.push(e);
			continue;
		}
		const fields = Object.fromEntries(
			Object.entries(e.fields).filter(([field]) => !(field in sent.fields)),
		) as ScoreEntry["fields"];
		if (Object.keys(fields).length > 0) kept.push({ ...e, fields });
	}
	writeQueue(storage, kept);
}
