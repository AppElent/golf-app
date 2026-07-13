export interface Club {
	name: string;
	carryMeters: number;
}

export function suggestClub(
	clubs: ReadonlyArray<Club>,
	targetMeters: number,
): Club | null {
	if (clubs.length === 0) return null;
	return clubs.reduce((best, club) => {
		const diff = Math.abs(club.carryMeters - targetMeters);
		const bestDiff = Math.abs(best.carryMeters - targetMeters);
		if (diff < bestDiff) return club;
		if (diff === bestDiff && club.carryMeters > best.carryMeters) return club;
		return best;
	});
}

/** Sensible starter bag in meters, used until Profile bag management (Plan 6). */
export const DEFAULT_BAG: ReadonlyArray<Club> = [
	{ name: "Driver", carryMeters: 230 },
	{ name: "3w", carryMeters: 210 },
	{ name: "5w", carryMeters: 195 },
	{ name: "4i", carryMeters: 180 },
	{ name: "5i", carryMeters: 170 },
	{ name: "6i", carryMeters: 160 },
	{ name: "7i", carryMeters: 150 },
	{ name: "8i", carryMeters: 140 },
	{ name: "9i", carryMeters: 130 },
	{ name: "PW", carryMeters: 120 },
	{ name: "GW", carryMeters: 105 },
	{ name: "SW", carryMeters: 90 },
];
