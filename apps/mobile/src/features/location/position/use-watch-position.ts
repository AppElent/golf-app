/**
 * Continuous foreground GPS for the Play screen: high accuracy, a fix every
 * couple of metres, stopped when the screen unmounts. Asks for permission on
 * first use (Play is the moment the user expects to be located).
 */
import type { LatLng } from "@fairway/core/geo";
import * as Location from "expo-location";
import { useEffect, useState } from "react";

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
		let subscription: Location.LocationSubscription | null = null;
		let cancelled = false;
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
					(fix) =>
						setState({
							permission: "granted",
							position: { lat: fix.coords.latitude, lng: fix.coords.longitude },
							accuracyMeters: fix.coords.accuracy ?? null,
						}),
				);
				if (cancelled) subscription.remove();
			} catch {
				// Services off: the screen falls back to distances from the tee.
			}
		})();
		return () => {
			cancelled = true;
			subscription?.remove();
		};
	}, [enabled]);

	return state;
}
