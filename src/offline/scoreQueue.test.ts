import { beforeEach, describe, expect, it } from "vitest";
import {
	accountQueue,
	enqueueScore,
	keyFor,
	keyOf,
	readQueue,
	removeSent,
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
		removeItem: (k) => {
			map.delete(k);
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
				removeItem: () => {},
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
		removeSent(storage, entry());
		expect(readQueue(storage).map((e) => e.holeIndex)).toEqual([1]);
	});

	it("keeps an entry edited while it was being sent", () => {
		enqueueScore(storage, entry());
		const [sent] = readQueue(storage);
		enqueueScore(storage, entry({ fields: { strokes: 9 } }));
		removeSent(storage, sent);
		expect(readQueue(storage).map((e) => e.fields.strokes)).toEqual([9]);
	});

	it("finds an entry under the key built from its parts", () => {
		const queued = entry({ holeIndex: 3, playerIndex: 2 });
		expect(keyFor("r1", 3, 2)).toBe(keyOf(queued));
		expect(keyFor("r1", 2, 3)).not.toBe(keyOf(queued));
	});
});

describe("accountQueue", () => {
	let storage: StorageLike;
	beforeEach(() => {
		storage = fakeStorage();
	});

	it("keeps each account's unsent scores apart", () => {
		enqueueScore(accountQueue(storage, "user_a"), entry());
		const b = accountQueue(storage, "user_b");
		expect(readQueue(b)).toEqual([]);
		enqueueScore(b, entry({ roundId: "rb" }));
		expect(readQueue(accountQueue(storage, "user_a"))).toEqual([entry()]);
		expect(
			readQueue(accountQueue(storage, "user_b")).map((e) => e.roundId),
		).toEqual(["rb"]);
	});

	it("gives the queue from before accounts were split to the first account, once", () => {
		enqueueScore(storage, entry());
		expect(readQueue(accountQueue(storage, "user_a"))).toEqual([entry()]);
		expect(readQueue(storage)).toEqual([]);
		expect(readQueue(accountQueue(storage, "user_b"))).toEqual([]);
		expect(readQueue(accountQueue(storage, "user_a"))).toEqual([entry()]);
	});

	it("keeps an account's own queue over the old one", () => {
		enqueueScore(accountQueue(storage, "user_a"), entry({ roundId: "mine" }));
		enqueueScore(storage, entry({ roundId: "old" }));
		expect(
			readQueue(accountQueue(storage, "user_a")).map((e) => e.roundId),
		).toEqual(["mine"]);
		expect(readQueue(storage)).toEqual([]);
	});
});
