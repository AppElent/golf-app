import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { accountQueue, enqueueScore, readQueue } from "./scoreQueue";

const mocks = vi.hoisted(() => ({
	userId: "user_a" as string | null,
	/** Rounds the signed-in user owns; Convex rejects the rest. */
	owned: { user_a: ["ra"], user_b: ["rb"] } as Record<string, string[]>,
	setScore: vi.fn(),
}));
vi.mock("@clerk/react", () => ({ useAuth: () => ({ userId: mocks.userId }) }));
vi.mock("convex/react", () => ({ useMutation: () => mocks.setScore }));
vi.mock("./useOnlineStatus", () => ({ useOnlineStatus: () => true }));

import { useScoreSync } from "./useScoreSync";

const entry = (roundId: string) => ({
	roundId,
	holeIndex: 0,
	playerIndex: 0,
	fields: { strokes: 5 },
});

// Node's own (file-less) localStorage shadows jsdom's, so use a plain one.
const store = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
	configurable: true,
	value: {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => store.set(key, value),
	},
});

beforeEach(() => {
	store.clear();
	mocks.userId = "user_a";
	mocks.setScore.mockReset();
	mocks.setScore.mockImplementation(
		async ({ roundId }: { roundId: string }) => {
			if (!mocks.owned[mocks.userId ?? ""]?.includes(roundId)) {
				throw new Error("Round not found.");
			}
		},
	);
});

it("never hands the old shared queue to the next golfer", async () => {
	// A wrote this offline before accounts were split, then signed out.
	enqueueScore(window.localStorage, entry("ra"));

	mocks.userId = "user_b";
	const b = renderHook(() => useScoreSync());
	await waitFor(() => expect(b.result.current.syncing).toBe(false));
	// B's flush tried it, Convex refused, and B neither owns nor counts it.
	expect(b.result.current.pendingCount).toBe(0);
	expect(readQueue(accountQueue(window.localStorage, "user_b"))).toEqual([]);
	expect(readQueue(window.localStorage)).toEqual([entry("ra")]);
	b.unmount();

	// A signs back in: their score goes and leaves the queue.
	mocks.userId = "user_a";
	const a = renderHook(() => useScoreSync());
	await waitFor(() => expect(readQueue(window.localStorage)).toEqual([]));
	expect(mocks.setScore).toHaveBeenLastCalledWith(
		expect.objectContaining({ roundId: "ra", queued: true }),
	);
	a.unmount();
});

it("keeps a signed-out golfer's queue from the next one", async () => {
	mocks.setScore.mockRejectedValue(new Error("offline"));
	const a = renderHook(() => useScoreSync());
	act(() => a.result.current.submit(entry("ra")));
	expect(a.result.current.pendingCount).toBe(1);
	a.unmount();
	mocks.setScore.mockClear();

	mocks.userId = "user_b";
	const b = renderHook(() => useScoreSync());
	expect(b.result.current.pendingCount).toBe(0);
	expect(b.result.current.hasPending("ra")).toBe(false);
	await waitFor(() => expect(b.result.current.syncing).toBe(false));
	expect(mocks.setScore).not.toHaveBeenCalledWith(
		expect.objectContaining({ roundId: "ra" }),
	);
	b.unmount();
	expect(readQueue(accountQueue(window.localStorage, "user_a"))).toHaveLength(
		1,
	);
});

it("shows the unclaimed edits on their own round without counting them", () => {
	mocks.setScore.mockReturnValue(new Promise(() => {}));
	enqueueScore(window.localStorage, entry("ra"));
	const a = renderHook(() => useScoreSync());
	expect(a.result.current.pendingCount).toBe(0);
	expect(a.result.current.hasPending("ra")).toBe(true);
	expect(a.result.current.scoreOf("ra", [], 0, 0)).toEqual({ strokes: 5 });
	a.unmount();
});

it("sends a hole's unclaimed edit before the account's newer one", async () => {
	enqueueScore(window.localStorage, entry("ra"));
	// A corrected that hole offline after the split.
	enqueueScore(accountQueue(window.localStorage, "user_a"), {
		...entry("ra"),
		fields: { strokes: 6 },
	});
	const a = renderHook(() => useScoreSync());
	await waitFor(() => expect(a.result.current.syncing).toBe(false));
	expect(mocks.setScore.mock.calls.map(([args]) => args.strokes)).toEqual([
		5, 6,
	]);
	expect(a.result.current.scoreOf("ra", [], 0, 0)).toBeUndefined();
	a.unmount();
});

it("never retries someone else's unclaimed edits on the timer", async () => {
	vi.useFakeTimers();
	try {
		enqueueScore(window.localStorage, entry("ra"));
		mocks.userId = "user_b";
		const b = renderHook(() => useScoreSync());
		await act(async () => {});
		const afterMount = mocks.setScore.mock.calls.length;
		await act(async () => {
			await vi.advanceTimersByTimeAsync(60_000);
		});
		expect(mocks.setScore).toHaveBeenCalledTimes(afterMount);
		b.unmount();
	} finally {
		vi.useRealTimers();
	}
});
