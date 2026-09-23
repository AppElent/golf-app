import { beforeEach, describe, expect, it } from "vitest";
import {
	enqueueScore,
	keyFor,
	keyOf,
	readQueue,
	removeEntry,
	type ScoreEntry,
	type StorageLike,
} from "./scoreQueue";

function fakeStorage(): StorageLike {
	const map = new Map<string, string>();
	return {
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => {
			map.set(k, v);
		},
	};
}

const entry = (over: Partial<ScoreEntry> = {}): ScoreEntry => ({
	roundId: "r1",
	holeIndex: 0,
	playerIndex: 0,
	fields: { strokes: 4 },
	...over,
});

describe("scoreQueue", () => {
	let storage: StorageLike;
	beforeEach(() => {
		storage = fakeStorage();
	});

	it("reads an empty queue when nothing is stored", () => {
		expect(readQueue(storage)).toEqual([]);
	});

	it("reads an empty queue when the stored value is corrupt", () => {
		storage.setItem("fairway.scoreQueue", "{not json");
		expect(readQueue(storage)).toEqual([]);
	});

	it("appends a new entry", () => {
		enqueueScore(storage, entry());
		const q = readQueue(storage);
		expect(q).toHaveLength(1);
		expect(q[0].fields).toEqual({ strokes: 4 });
	});

	it("merges fields into the existing entry for the same key", () => {
		enqueueScore(storage, entry({ fields: { strokes: 4 } }));
		enqueueScore(storage, entry({ fields: { putts: 2 } }));
		const q = readQueue(storage);
		expect(q).toHaveLength(1);
		expect(q[0].fields).toEqual({ strokes: 4, putts: 2 });
	});

	it("keeps distinct keys separate", () => {
		enqueueScore(storage, entry({ holeIndex: 0 }));
		enqueueScore(storage, entry({ holeIndex: 1 }));
		expect(readQueue(storage)).toHaveLength(2);
	});

	it("removes an entry by key", () => {
		enqueueScore(storage, entry());
		removeEntry(storage, keyOf(entry()));
		expect(readQueue(storage)).toEqual([]);
	});

	it("builds a stable composite key", () => {
		expect(keyFor("r1", 3, 2)).toBe("r1:3:2");
		expect(keyOf(entry({ holeIndex: 3, playerIndex: 2 }))).toBe("r1:3:2");
	});
});
