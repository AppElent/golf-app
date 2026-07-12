import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
	enqueueScore,
	keyOf,
	readQueue,
	removeEntry,
	type ScoreEntry,
	type ScoreFields,
	type StorageLike,
} from "./scoreQueue";

const FLUSH_INTERVAL_MS = 15000;

function storage(): StorageLike | null {
	if (typeof window === "undefined") return null;
	return window.localStorage;
}

function overlayFrom(store: StorageLike | null): Map<string, ScoreFields> {
	const map = new Map<string, ScoreFields>();
	if (!store) return map;
	for (const entry of readQueue(store)) map.set(keyOf(entry), entry.fields);
	return map;
}

export interface ScoreSync {
	submit: (entry: ScoreEntry) => void;
	pending: Map<string, ScoreFields>;
	pendingCount: number;
	syncing: boolean;
}

export function useScoreSync(): ScoreSync {
	const setScore = useMutation(api.rounds.setScore);
	const online = useOnlineStatus();
	const [pending, setPending] = useState<Map<string, ScoreFields>>(() =>
		overlayFrom(storage()),
	);
	const [syncing, setSyncing] = useState(false);
	const flushing = useRef(false);

	const refresh = useCallback(() => setPending(overlayFrom(storage())), []);

	const flush = useCallback(async () => {
		const store = storage();
		if (!store || flushing.current) return;
		if (typeof navigator !== "undefined" && !navigator.onLine) return;
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
					// Network/permission failure — leave the rest queued, retry later.
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

	// Flush when connectivity returns.
	useEffect(() => {
		if (online) void flush();
	}, [online, flush]);

	// Periodic retry while anything is queued.
	useEffect(() => {
		const id = setInterval(() => {
			if (pending.size > 0) void flush();
		}, FLUSH_INTERVAL_MS);
		return () => clearInterval(id);
	}, [flush, pending.size]);

	return { submit, pending, pendingCount: pending.size, syncing };
}
