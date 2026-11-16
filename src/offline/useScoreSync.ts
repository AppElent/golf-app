import { useAuth } from "@clerk/react";
import { type HoleScore, type ScoreUpdate, scoreAt } from "@fairway/core/round";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
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
import { useOnlineStatus } from "./useOnlineStatus";

const FLUSH_INTERVAL_MS = 15000;

/** The signed-in account's queue; none outside the browser or signed out.
 *  Only screens behind AuthGate use it, so a score is never dropped for want
 *  of an account. */
function queueStorage(userId: string | null | undefined): StorageLike | null {
	if (typeof window === "undefined" || !userId) return null;
	return accountQueue(window.localStorage, userId);
}

function overlayFrom(store: StorageLike | null): Map<string, ScoreUpdate> {
	const map = new Map<string, ScoreUpdate>();
	if (!store) return map;
	for (const entry of readQueue(store)) map.set(keyOf(entry), entry.fields);
	return map;
}

export function useScoreSync() {
	const setScore = useMutation(api.rounds.setScore);
	const online = useOnlineStatus();
	const { userId } = useAuth();
	const storage = useCallback(() => queueStorage(userId), [userId]);
	const [pending, setPending] = useState<Map<string, ScoreUpdate>>(() =>
		overlayFrom(storage()),
	);
	const [syncing, setSyncing] = useState(false);
	const flushing = useRef(false);
	const flushAgain = useRef(false);

	const refresh = useCallback(
		() => setPending(overlayFrom(storage())),
		[storage],
	);
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
				for (const entry of readQueue(store)) {
					try {
						await setScore({
							roundId: entry.roundId as Id<"rounds">,
							holeIndex: entry.holeIndex,
							playerIndex: entry.playerIndex,
							queued: true,
							...entry.fields,
						});
						removeSent(store, entry);
						refresh();
					} catch {
						// Stays queued for the retry. Entries are per hole and player, so
						// the ones behind it can still go.
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
			enqueueScore(store, entry);
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
			const overlay = pending.get(keyFor(roundId, holeIndex, playerIndex));
			if (!server && !overlay) return undefined;
			return { ...server, ...overlay };
		},
		[pending],
	);

	/** The queue can hold another round's scores, so ask about one round. */
	const hasPending = useCallback(
		(roundId: string) =>
			[...pending.keys()].some((key) => key.startsWith(`${roundId}:`)),
		[pending],
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
