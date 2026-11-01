/**
 * One foreground position fix for screens that sort or measure by "where am
 * I" (course picker). Asks for permission only when `request()` is called or
 * permission was already granted — never on mount of a screen that merely
 * could use it. Continuous on-course tracking is `use-watch-position`.
 */
import type { LatLng } from "@fairway/core/geo";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

export type PositionState =
	| { status: "unknown" }
	| { status: "denied" }
	/** Permission granted but no fix (services off, no signal). */
	| { status: "unavailable" }
	| { status: "locating" }
	| { status: "ready"; position: LatLng; accuracyMeters: number | null };

const toLatLng = (fix: Location.LocationObject): PositionState => ({
	status: "ready",
	position: { lat: fix.coords.latitude, lng: fix.coords.longitude },
	accuracyMeters: fix.coords.accuracy ?? null,
});

export function useCurrentPosition() {
	const [state, setState] = useState<PositionState>({ status: "unknown" });

	const locate = useCallback(async () => {
		setState({ status: "locating" });
		try {
			const last = await Location.getLastKnownPositionAsync({
				maxAge: 10 * 60_000,
			});
			if (last) setState(toLatLng(last));
			const fresh = await Location.getCurrentPositionAsync({
				// High uses GPS directly; Balanced makes Android ask the user to
				// turn on Google Location Accuracy first.
				accuracy: Location.Accuracy.High,
			});
			setState(toLatLng(fresh));
		} catch {
			// No fix (simulator without a location, services off): keep any
			// last-known fix, otherwise offer a retry over the unsorted list.
			setState((prev) =>
				prev.status === "ready" ? prev : { status: "unavailable" },
			);
		}
	}, []);

	const request = useCallback(async () => {
		const { granted } = await Location.requestForegroundPermissionsAsync();
		if (granted) await locate();
		else setState({ status: "denied" });
	}, [locate]);

	useEffect(() => {
		let cancelled = false;
		Location.getForegroundPermissionsAsync().then(({ granted }) => {
			if (!cancelled && granted) void locate();
		});
		return () => {
			cancelled = true;
		};
	}, [locate]);

	return { state, request };
}
