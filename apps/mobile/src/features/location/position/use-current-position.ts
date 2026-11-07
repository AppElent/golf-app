import type { LatLng } from "@fairway/core/geo";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { fixReading } from "../location-fix";

type PositionState =
	| { status: "unknown" }
	| { status: "denied" }
	/** Permission granted but no fix (services off, no signal). */
	| { status: "unavailable" }
	| { status: "locating" }
	| { status: "ready"; position: LatLng; accuracyMeters: number | null };

const readyState = (fix: Location.LocationObject): PositionState => ({
	status: "ready",
	...fixReading(fix),
});

export function useCurrentPosition() {
	const [state, setState] = useState<PositionState>({ status: "unknown" });

	const locate = useCallback(async () => {
		setState({ status: "locating" });
		try {
			const last = await Location.getLastKnownPositionAsync({
				maxAge: 10 * 60_000,
			});
			if (last) setState(readyState(last));
			const fresh = await Location.getCurrentPositionAsync({
				// High uses GPS directly; Balanced makes Android ask the user to
				// turn on Google Location Accuracy first.
				accuracy: Location.Accuracy.High,
			});
			setState(readyState(fresh));
		} catch {
			// No fix (simulator without a location, services off).
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
