import Storage from "expo-sqlite/kv-store";
import {
	clearLastKnown,
	confirmAccount,
	diskScope,
	entryKey,
	writeEntry,
} from "../../../convex/last-known";
import { offlineRound } from "./offline-round";

const store = Storage as unknown as { __clear: () => void };

const ACTIVE = {
	round: {
		_id: "r1",
		courseId: "c1",
		currentHoleIndex: 4,
		holeRefs: ["1", "2", "3", "4", "5"],
	},
	course: { name: "Welderen" },
	tee: { marker: "yellow" },
	holes: [],
	scores: [],
};
const DETAIL = {
	course: { name: "Welderen" },
	holes: [],
	geometry: [],
	tees: [],
};

function save(account: string, name: string, value: unknown, args = {}) {
	writeEntry(
		entryKey(diskScope(account), name, args) as string,
		value as never,
	);
}

function saveRound(account = "alice") {
	save(account, "rounds:active", ACTIVE);
	save(account, "courses:get", DETAIL, { courseId: "c1" });
}

beforeEach(() => store.__clear());

describe("offlineRound", () => {
	it("draws the saved round and its course for the confirmed account", () => {
		confirmAccount("alice");
		saveRound();
		save("alice", "settings:get", { units: "yd" });
		const round = offlineRound("alice");
		expect(round?.active.round.currentHoleIndex).toBe(4);
		expect(round?.detail).toEqual(DETAIL);
		expect(round?.units).toBe("yd");
		expect(round?.clubs).toEqual([]);
	});

	it("is nothing without a confirmed account match", () => {
		saveRound();
		expect(offlineRound("alice")).toBeNull();
		confirmAccount("alice");
		expect(offlineRound("bob")).toBeNull();
		expect(offlineRound(null)).toBeNull();
	});

	it("is nothing when the course copy is missing", () => {
		confirmAccount("alice");
		save("alice", "rounds:active", ACTIVE);
		expect(offlineRound("alice")).toBeNull();
	});

	it("is nothing for no round, a damaged round, or a simulation", () => {
		confirmAccount("alice");
		save("alice", "rounds:active", null);
		expect(offlineRound("alice")).toBeNull();
		save("alice", "rounds:active", { round: { _id: "r1" } });
		expect(offlineRound("alice")).toBeNull();
		save("alice", "rounds:active", {
			...ACTIVE,
			round: { ...ACTIVE.round, simulated: true },
		});
		save("alice", "courses:get", DETAIL, { courseId: "c1" });
		expect(offlineRound("alice")).toBeNull();
	});

	it("is nothing after sign-out", () => {
		confirmAccount("alice");
		saveRound();
		clearLastKnown();
		expect(offlineRound("alice")).toBeNull();
	});
});
