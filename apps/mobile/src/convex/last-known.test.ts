import Storage from "expo-sqlite/kv-store";
import {
	clearLastKnown,
	confirmAccount,
	confirmedAccount,
	diskScope,
	entryKey,
	MAX_ENTRIES,
	MAX_VALUE_LENGTH,
	readEntry,
	readOfflineEntry,
	writeEntry,
} from "./last-known";

const store = Storage as unknown as {
	__clear: () => void;
	getAllKeysSync: () => string[];
	setItemSync: (key: string, value: string) => void;
	getItemSync: (key: string) => string | null;
};

const key = (account: string, name: string, args = {}) =>
	entryKey(diskScope(account), name, args) as string;

beforeEach(() => store.__clear());

describe("last-known copy", () => {
	it("round-trips Convex values, bigint and bytes included", () => {
		const value = {
			n: 3n,
			bytes: new Uint8Array([1, 2]).buffer,
			x: Number.NaN,
		};
		writeEntry(key("alice", "rounds:active"), value);
		const read = readEntry(key("alice", "rounds:active")) as typeof value;
		expect(read.n).toBe(3n);
		expect(new Uint8Array(read.bytes)).toEqual(new Uint8Array([1, 2]));
		expect(read.x).toBeNaN();
	});

	it("reads a corrupt or missing entry as a miss", () => {
		store.setItemSync(key("alice", "rounds:active"), "{not json");
		expect(readEntry(key("alice", "rounds:active"))).toBeUndefined();
		expect(readEntry(key("alice", "courses:get"))).toBeUndefined();
	});

	it("never reads another bundle's copy", () => {
		const old = entryKey(diskScope("alice", "old+bundle"), "rounds:active", {});
		writeEntry(old as string, { round: 1 });
		expect(readEntry(key("alice", "rounds:active"))).toBeUndefined();
	});

	it("skips oversized values and bounds the entry count", () => {
		writeEntry(key("alice", "big"), "x".repeat(MAX_VALUE_LENGTH + 1));
		expect(readEntry(key("alice", "big"))).toBeUndefined();
		for (let i = 0; i < MAX_ENTRIES + 10; i++)
			writeEntry(key("alice", "courses:get", { courseId: `c${i}` }), i);
		expect(store.getAllKeysSync().length).toBeLessThanOrEqual(MAX_ENTRIES);
	});

	it("confirming an account prunes other accounts and bundles", () => {
		writeEntry(key("alice", "rounds:active"), 1);
		writeEntry(key("bob", "rounds:active"), 2);
		writeEntry(
			entryKey(diskScope("alice", "old"), "rounds:active", {}) as string,
			3,
		);
		confirmAccount("alice");
		expect(confirmedAccount()).toBe("alice");
		expect(readEntry(key("alice", "rounds:active"))).toBe(1);
		expect(store.getAllKeysSync()).toHaveLength(2); // alice's entry + marker
	});

	it("reads offline only for the account Convex last confirmed", () => {
		confirmAccount("alice");
		writeEntry(key("alice", "rounds:active"), 1);
		expect(readOfflineEntry("alice", "rounds:active", {})).toBe(1);
		expect(readOfflineEntry("bob", "rounds:active", {})).toBeUndefined();
	});

	it("sign-out clears the copy and the marker", () => {
		confirmAccount("alice");
		writeEntry(key("alice", "rounds:active"), 1);
		clearLastKnown();
		expect(confirmedAccount()).toBeNull();
		expect(store.getAllKeysSync()).toHaveLength(0);
		expect(readOfflineEntry("alice", "rounds:active", {})).toBeUndefined();
	});
});
