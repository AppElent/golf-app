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
