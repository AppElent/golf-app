import { beforeEach, describe, expect, it } from "vitest";
import {
	forgetRetiredScoreQueues,
	forgetRetiredScoreQueuesHere,
} from "./retired-score-queue";

/** This jsdom has no working localStorage; a Map stands in for it. */
function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		key: (i) => [...items.keys()][i] ?? null,
		getItem: (k) => items.get(k) ?? null,
		setItem: (k, v) => void items.set(k, String(v)),
		removeItem: (k) => void items.delete(k),
		clear: () => items.clear(),
	};
}

beforeEach(() => {
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		value: memoryStorage(),
	});
});

describe("forgetRetiredScoreQueues", () => {
	it("removes the unclaimed queue and every account's queue", () => {
		const storage = window.localStorage;
		storage.setItem("fairway.scoreQueue", '[{"roundId":"r1"}]');
		storage.setItem("fairway.scoreQueue:user_a", "[]");
		storage.setItem("fairway.scoreQueue:user_b", '[{"roundId":"r2"}]');

		expect(forgetRetiredScoreQueues(storage)).toBe(3);

		expect(storage.getItem("fairway.scoreQueue")).toBeNull();
		expect(storage.getItem("fairway.scoreQueue:user_a")).toBeNull();
		expect(storage.getItem("fairway.scoreQueue:user_b")).toBeNull();
	});

	it("leaves every other key alone", () => {
		const storage = window.localStorage;
		storage.setItem("fairway.scoreQueue", "[]");
		storage.setItem("fairway.scoreQueueBackup", "keep");
		storage.setItem("fairway.theme", "dark");
		storage.setItem("other.fairway.scoreQueue", "keep");

		expect(forgetRetiredScoreQueues(storage)).toBe(1);

		expect(storage.getItem("fairway.scoreQueueBackup")).toBe("keep");
		expect(storage.getItem("fairway.theme")).toBe("dark");
		expect(storage.getItem("other.fairway.scoreQueue")).toBe("keep");
	});

	it("does nothing on a browser without queues", () => {
		expect(forgetRetiredScoreQueues(window.localStorage)).toBe(0);
	});
});

describe("forgetRetiredScoreQueuesHere", () => {
	it("sweeps this browser's localStorage", () => {
		window.localStorage.setItem("fairway.scoreQueue", "[]");
		forgetRetiredScoreQueuesHere();
		expect(window.localStorage.getItem("fairway.scoreQueue")).toBeNull();
	});

	it("survives storage that throws", () => {
		const original = Object.getOwnPropertyDescriptor(window, "localStorage");
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			get() {
				throw new DOMException("blocked", "SecurityError");
			},
		});
		try {
			expect(() => forgetRetiredScoreQueuesHere()).not.toThrow();
		} finally {
			if (original) Object.defineProperty(window, "localStorage", original);
		}
	});
});
