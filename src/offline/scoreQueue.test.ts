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

	it.each(["{not json", '{"not":"a list"}'])(
		"reads an empty queue when the stored value is %s",
		(stored) => {
			const unreadable: StorageLike = {
				getItem: () => stored,
				setItem: () => {},
			};
			expect(readQueue(unreadable)).toEqual([]);
		},
	);

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

	it("keeps other rounds, holes and players separate", () => {
		enqueueScore(storage, entry());
		enqueueScore(storage, entry({ roundId: "r2" }));
		enqueueScore(storage, entry({ holeIndex: 1 }));
		enqueueScore(storage, entry({ playerIndex: 1 }));
		expect(readQueue(storage)).toHaveLength(4);
	});

	it("removes only the entry with that key", () => {
		enqueueScore(storage, entry());
		enqueueScore(storage, entry({ holeIndex: 1 }));
		removeEntry(storage, keyOf(entry()));
		expect(readQueue(storage).map((e) => e.holeIndex)).toEqual([1]);
	});

	it("finds an entry under the key built from its parts", () => {
		const queued = entry({ holeIndex: 3, playerIndex: 2 });
		expect(keyFor("r1", 3, 2)).toBe(keyOf(queued));
		expect(keyFor("r1", 2, 3)).not.toBe(keyOf(queued));
	});
});
