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

/** Sensible starter bag in meters, used until a player has added clubs. */
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

/** A default club fills a gap only when no club of the player's carries within this. */
const BAND_METERS = 10;
/** With this many clubs the player's own bag is the whole bag. */
const FULL_BAG = 8;

/**
 * The defaults a player's bag lacks: those no club of theirs shares a name
 * with or carries within ±10 m of.
 */
export function missingDefaults(
	userClubs: ReadonlyArray<Club>,
	defaults: ReadonlyArray<Club> = DEFAULT_BAG,
): Club[] {
	const names = new Set(userClubs.map((c) => c.name.trim().toLowerCase()));
	return defaults.filter(
		(d) =>
			!names.has(d.name.toLowerCase()) &&
			!userClubs.some(
				(c) => Math.abs(c.carryMeters - d.carryMeters) <= BAND_METERS,
			),
	);
}

/**
 * The bag club advice works from: every club of the player's, plus default
 * clubs for the distances theirs leave uncovered, longest first. A player
 * with 8 or more clubs gets exactly their own.
 */
export function effectiveBag<C extends Club>(
	userClubs: ReadonlyArray<C>,
	defaults: ReadonlyArray<Club> = DEFAULT_BAG,
): Array<C | Club> {
	if (userClubs.length >= FULL_BAG) return [...userClubs];
	return [...userClubs, ...missingDefaults(userClubs, defaults)].sort(
		(a, b) => b.carryMeters - a.carryMeters,
	);
}
