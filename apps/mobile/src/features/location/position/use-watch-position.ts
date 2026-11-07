/**
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
import { fixReading } from "../location-fix";

const STALE_MS = 15_000;

interface WatchedPosition {
	position: LatLng | null;
	accuracyMeters: number | null;
}

/** Off (simulation mode), it never asks for location or starts the watch. */
export function useWatchPosition(enabled: boolean): WatchedPosition {
	const [state, setState] = useState<WatchedPosition>({
		position: null,
		accuracyMeters: null,
	});

	useEffect(() => {
		if (!enabled) return;
		let fixedAt = 0;
		let subscription: Location.LocationSubscription | null = null;
		let cancelled = false;
		const accept = (fix: Location.LocationObject) => {
			fixedAt = Date.now();
			setState(fixReading(fix));
		};
		const appState = AppState.addEventListener("change", (next) => {
			if (next === "active" && Date.now() - fixedAt > STALE_MS) {
				setState({ position: null, accuracyMeters: null });
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
			if (cancelled || !granted) return;
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
