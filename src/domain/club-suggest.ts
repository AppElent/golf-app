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
