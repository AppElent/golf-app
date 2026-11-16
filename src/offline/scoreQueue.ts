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
	removeItem(key: string): void;
}

const QUEUE_KEY = "fairway.scoreQueue";

/**
 * The queue of one signed-in account, so a golfer who signs in after another
 * on this browser neither sends nor sees the first one's unsent scores. The
 * queue from before accounts were split goes to the first account to open it:
 * the web had no sign-out then, so that is the golfer who wrote it.
 */
export function accountQueue(
	storage: StorageLike,
	userId: string,
): StorageLike {
	const own = `${QUEUE_KEY}:${userId}`;
	const scoped = (key: string) => (key === QUEUE_KEY ? own : key);
	const queue: StorageLike = {
		getItem: (key) => storage.getItem(scoped(key)),
		setItem: (key, value) => storage.setItem(scoped(key), value),
		removeItem: (key) => storage.removeItem(scoped(key)),
	};
	if (storage.getItem(QUEUE_KEY) !== null) {
		// Merged, not replaced: a tab still on the old code may have written it.
		for (const entry of readQueue(storage)) enqueueScore(queue, entry);
		storage.removeItem(QUEUE_KEY);
	}
	return queue;
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
