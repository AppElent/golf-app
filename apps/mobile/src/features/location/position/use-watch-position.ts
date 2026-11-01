/**
 * Continuous foreground GPS for the Play screen: high accuracy, a fix every
 * couple of metres, stopped when the screen unmounts. Asks for permission on
 * first use (Play is the moment the user expects to be located).
 *
 * iOS pauses the watch while the phone is locked, so a fix from before the
 * lock is dropped on return once it is older than `STALE_MS`, and a fresh one
 * is requested: until it arrives the screen measures from the tee rather than
 * from where the player stood minutes ago (and a marked shot can't land on
 * the old spot).
 */
import type { LatLng } from "@fairway/core/geo";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

const STALE_MS = 15_000;

export interface WatchedPosition {
	position: LatLng | null;
	accuracyMeters: number | null;
	permission: "unknown" | "granted" | "denied";
}

export function useWatchPosition(enabled = true): WatchedPosition {
	const [state, setState] = useState<WatchedPosition>({
		position: null,
		accuracyMeters: null,
		permission: "unknown",
	});

	useEffect(() => {
		if (!enabled) return;
		let fixedAt = 0;
		let subscription: Location.LocationSubscription | null = null;
		let cancelled = false;
		const accept = (fix: Location.LocationObject) => {
			fixedAt = Date.now();
			setState({
				permission: "granted",
				position: { lat: fix.coords.latitude, lng: fix.coords.longitude },
				accuracyMeters: fix.coords.accuracy ?? null,
			});
		};
		const appState = AppState.addEventListener("change", (next) => {
			if (next === "active" && Date.now() - fixedAt > STALE_MS) {
				setState((s) => ({ ...s, position: null, accuracyMeters: null }));
				// The watch reports only after moving a couple of metres, so a
				// player standing at the ball would wait on the tee fallback.
				Location.getCurrentPositionAsync({
					accuracy: Location.Accuracy.BestForNavigation,
				})
					.then((fix) => {
						if (!cancelled) accept(fix);
					})
					.catch(() => {});
			}
		});
		(async () => {
			const { granted } = await Location.requestForegroundPermissionsAsync();
			if (cancelled) return;
			if (!granted) {
				setState((s) => ({ ...s, permission: "denied" }));
				return;
			}
			setState((s) => ({ ...s, permission: "granted" }));
			try {
				subscription = await Location.watchPositionAsync(
					{
						accuracy: Location.Accuracy.BestForNavigation,
						distanceInterval: 2,
						timeInterval: 2000,
					},
					accept,
				);
				if (cancelled) subscription.remove();
			} catch {
				// Services off: the screen falls back to distances from the tee.
			}
		})();
		return () => {
			cancelled = true;
			appState.remove();
			subscription?.remove();
		};
	}, [enabled]);

	return state;
}
