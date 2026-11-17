import { useAuth } from "@clerk/react";
import { type HoleScore, type ScoreUpdate, scoreAt } from "@fairway/core/round";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
	accountQueue,
	dropSuperseded,
	enqueueScore,
	keyFor,
	keyOf,
	readQueue,
	removeSent,
	type ScoreEntry,
	type StorageLike,
} from "./scoreQueue";
import { useOnlineStatus } from "./useOnlineStatus";

const FLUSH_INTERVAL_MS = 15000;

/** The signed-in account's queue and the unclaimed one (see `accountQueue`);
 *  none outside the browser or signed out. Only screens behind AuthGate use
 *  it, so a score is never dropped for want of an account. */
function queues(
	userId: string | null | undefined,
): { own: StorageLike; unclaimed: StorageLike } | null {
	if (typeof window === "undefined" || !userId) return null;
	return {
		own: accountQueue(window.localStorage, userId),
		unclaimed: window.localStorage,
	};
}

function overlayFrom(store: StorageLike | undefined): Map<string, ScoreUpdate> {
	const map = new Map<string, ScoreUpdate>();
	if (!store) return map;
	for (const entry of readQueue(store)) map.set(keyOf(entry), entry.fields);
	return map;
}

export function useScoreSync() {
	const setScore = useMutation(api.rounds.setScore);
	const online = useOnlineStatus();
	const { userId } = useAuth();
	const storage = useCallback(() => queues(userId), [userId]);
	const [pending, setPending] = useState<Map<string, ScoreUpdate>>(() =>
		overlayFrom(storage()?.own),
	);
	// Edits from before accounts were split. Shown on their own round (another
	// account never opens it) but not counted: they may be someone else's.
	const [unclaimed, setUnclaimed] = useState<Map<string, ScoreUpdate>>(() =>
		overlayFrom(storage()?.unclaimed),
	);
	const [syncing, setSyncing] = useState(false);
	const flushing = useRef(false);
	const flushAgain = useRef(false);

	const refresh = useCallback(() => {
		const store = storage();
		setPending(overlayFrom(store?.own));
		setUnclaimed(overlayFrom(store?.unclaimed));
	}, [storage]);
	// Another account's queue never shows: reload it when the account changes.
	useEffect(refresh, [refresh]);

	const flush = useCallback(async () => {
		const store = storage();
		if (!store) return;
		if (flushing.current) {
			flushAgain.current = true;
			return;
		}
		if (!navigator.onLine) return;
		flushing.current = true;
		setSyncing(true);
		try {
			do {
				flushAgain.current = false;
				// Oldest first: an account's own edit of a hole is newer than an
				// unclaimed one, and the server keeps the last write.
				for (const queue of [store.unclaimed, store.own]) {
					for (const entry of readQueue(queue)) {
						try {
							await setScore({
								roundId: entry.roundId as Id<"rounds">,
								holeIndex: entry.holeIndex,
								playerIndex: entry.playerIndex,
								queued: true,
								...entry.fields,
							});
							removeSent(queue, entry);
							// The hole proved to be this account's, so an unclaimed edit of
							// it that failed just now must not land later over this one.
							if (queue === store.own) dropSuperseded(store.unclaimed, entry);
							refresh();
						} catch {
							// Stays queued for the retry (or, unclaimed, for its owner).
							// Entries are per hole and player, so the ones behind it can
							// still go.
						}
					}
				}
			} while (flushAgain.current);
		} finally {
			refresh();
			flushing.current = false;
			setSyncing(false);
		}
	}, [setScore, refresh, storage]);

	const submit = useCallback(
		(entry: ScoreEntry) => {
			const store = storage();
			if (!store) return;
			enqueueScore(store.own, entry);
			refresh();
			void flush();
		},
		[flush, refresh, storage],
	);

	useEffect(() => {
		if (online) void flush();
	}, [online, flush]);

	useEffect(() => {
		const id = setInterval(() => {
			if (pending.size > 0) void flush();
		}, FLUSH_INTERVAL_MS);
		return () => clearInterval(id);
	}, [flush, pending.size]);

	/** One result as the server has it, with this device's unsynced edits on top. */
	const scoreOf = useCallback(
		(
			roundId: string,
			scores: ReadonlyArray<HoleScore>,
			holeIndex: number,
			playerIndex: number,
		): ScoreUpdate | undefined => {
			const server = scoreAt(scores, holeIndex, playerIndex);
			const key = keyFor(roundId, holeIndex, playerIndex);
			const own = pending.get(key);
			const old = unclaimed.get(key);
			if (!server && !own && !old) return undefined;
			return { ...server, ...old, ...own };
		},
		[pending, unclaimed],
	);

	/** The queue can hold another round's scores, so ask about one round. */
	const hasPending = useCallback(
		(roundId: string) =>
			[...pending.keys(), ...unclaimed.keys()].some((key) =>
				key.startsWith(`${roundId}:`),
			),
		[pending, unclaimed],
	);

	return {
		submit,
		scoreOf,
		hasPending,
		pendingCount: pending.size,
		syncing,
		online,
	};
}
