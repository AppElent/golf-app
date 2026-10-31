export type Units = "m" | "yd";

const YARDS_PER_METER = 1.09361;

export function metersToYards(meters: number): number {
	return meters * YARDS_PER_METER;
}

/** Human distance in the chosen units. `null` → em dash. */
export function formatDistance(
	meters: number | null | undefined,
	units: Units,
): string {
	if (meters == null) return "—";
	const value = units === "yd" ? metersToYards(meters) : meters;
	return `${Math.round(value)} ${units}`;
}

/** Driving-scale distance (course picker): "850 m" / "12 km", or miles in yd mode. */
export function formatTravelDistance(meters: number, units: Units): string {
	if (units === "yd") {
		const miles = meters / 1609.344;
		return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
	}
	if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
	const km = meters / 1000;
	return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
