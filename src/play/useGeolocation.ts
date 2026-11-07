import type { LatLng } from "@fairway/core/geo";
import { useEffect, useState } from "react";

/** Off (simulation mode), it never asks for location. */
export function useGeolocation(enabled: boolean) {
	const [fix, setFix] = useState<{
		position: LatLng | null;
		accuracyM: number | null;
	}>({ position: null, accuracyM: null });

	useEffect(() => {
		if (!enabled || !navigator.geolocation) return;
		const id = navigator.geolocation.watchPosition(
			(pos) =>
				setFix({
					position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
					accuracyM: pos.coords.accuracy,
				}),
			undefined,
			{ enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
		);
		return () => navigator.geolocation.clearWatch(id);
	}, [enabled]);

	return fix;
}
