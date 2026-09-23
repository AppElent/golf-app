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
