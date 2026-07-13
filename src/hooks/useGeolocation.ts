import { useEffect, useState } from "react";
import type { LatLng } from "../domain/geo";

export interface GeoState {
	position: LatLng | null;
	accuracyM: number | null;
	error: string | null;
	supported: boolean;
}

/**
 * Live position via watchPosition. Null position until the first fix; the Play
 * screen falls back to the tee (spec §8). `enabled` lets the caller stop the
 * watch (e.g. round finished).
 */
export function useGeolocation(enabled = true): GeoState {
	const [state, setState] = useState<GeoState>({
		position: null,
		accuracyM: null,
		error: null,
		supported: typeof navigator !== "undefined" && "geolocation" in navigator,
	});

	useEffect(() => {
		if (
			!enabled ||
			typeof navigator === "undefined" ||
			!navigator.geolocation
		) {
			return;
		}
		const id = navigator.geolocation.watchPosition(
			(pos) =>
				setState((s) => ({
					...s,
					position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
					accuracyM: pos.coords.accuracy,
					error: null,
				})),
			(err) => setState((s) => ({ ...s, error: err.message })),
			{ enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
		);
		return () => navigator.geolocation.clearWatch(id);
	}, [enabled]);

	return state;
}
