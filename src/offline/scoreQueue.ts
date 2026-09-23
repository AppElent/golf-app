export interface ScoreFields {
	strokes?: number;
	putts?: number;
	fir?: boolean;
	gir?: boolean;
	penalties?: number;
	nr?: boolean;
}

export interface ScoreEntry {
	roundId: string;
	holeIndex: number;
	playerIndex: number;
	fields: ScoreFields;
}

/** Minimal storage surface — real `localStorage` or a test fake. */
export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

const QUEUE_KEY = "fairway.scoreQueue";

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

/** Add or merge an entry; merged fields accumulate for the same key. */
export function enqueueScore(
	storage: StorageLike,
	entry: ScoreEntry,
): ScoreEntry[] {
	const queue = readQueue(storage);
	const key = keyOf(entry);
	const existing = queue.find((e) => keyOf(e) === key);
	if (existing) {
		existing.fields = { ...existing.fields, ...entry.fields };
	} else {
		queue.push(entry);
	}
	writeQueue(storage, queue);
	return queue;
}

export function removeEntry(storage: StorageLike, key: string): ScoreEntry[] {
	const queue = readQueue(storage).filter((e) => keyOf(e) !== key);
	writeQueue(storage, queue);
	return queue;
}
