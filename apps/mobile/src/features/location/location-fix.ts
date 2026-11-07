import type { LatLng } from "@fairway/core/geo";
import type { LocationObject } from "expo-location";

export function fixReading(fix: LocationObject): {
	position: LatLng;
	accuracyMeters: number | null;
} {
	return {
		position: { lat: fix.coords.latitude, lng: fix.coords.longitude },
		accuracyMeters: fix.coords.accuracy ?? null,
	};
}
