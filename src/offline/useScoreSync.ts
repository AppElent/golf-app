import { type HoleScore, type ScoreUpdate, scoreAt } from "@fairway/core/round";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
	enqueueScore,
	keyFor,
	keyOf,
	readQueue,
	removeEntry,
	type ScoreEntry,
	type StorageLike,
} from "./scoreQueue";
import { useOnlineStatus } from "./useOnlineStatus";

const FLUSH_INTERVAL_MS = 15000;

function storage(): StorageLike | null {
	if (typeof window === "undefined") return null;
	return window.localStorage;
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
	const [pending, setPending] = useState<Map<string, ScoreUpdate>>(() =>
		overlayFrom(storage()),
	);
	const [syncing, setSyncing] = useState(false);
	const flushing = useRef(false);

	const refresh = useCallback(() => setPending(overlayFrom(storage())), []);

	const flush = useCallback(async () => {
		const store = storage();
		if (!store || flushing.current) return;
		if (!navigator.onLine) return;
		flushing.current = true;
		setSyncing(true);
		try {
			for (const entry of readQueue(store)) {
				try {
					await setScore({
						roundId: entry.roundId as Id<"rounds">,
						holeIndex: entry.holeIndex,
						playerIndex: entry.playerIndex,
						...entry.fields,
					});
					removeEntry(store, keyOf(entry));
					refresh();
				} catch {
					// Keep order: everything after a failure stays queued for the retry.
					break;
				}
			}
		} finally {
			flushing.current = false;
			setSyncing(false);
		}
	}, [setScore, refresh]);

	const submit = useCallback(
		(entry: ScoreEntry) => {
			const store = storage();
			if (!store) return;
			enqueueScore(store, entry);
			refresh();
			void flush();
		},
		[flush, refresh],
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

	return { submit, scoreOf, pendingCount: pending.size, syncing, online };
}
