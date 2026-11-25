import { type HoleScore, holeNets, netRank, type RoundTeam } from "./round";

/** WHS scramble allowances in percent, lowest handicap first, by team size. */
const ALLOWANCES: Record<number, readonly number[]> = {
	2: [35, 15],
	3: [30, 20, 10],
	4: [25, 20, 15, 10],
};

/** A team's playing handicap. Whole percents, so a half rounds exactly. */
export function teamHandicap(playingHandicaps: readonly number[]): number {
	const allowances = ALLOWANCES[playingHandicaps.length];
	if (!allowances) return 0;
	const percent = [...playingHandicaps]
		.sort((a, b) => a - b)
		.reduce((sum, handicap, i) => sum + handicap * allowances[i], 0);
	// `|| 0`: Math.round gives -0 for a small plus handicap.
	return Math.round(percent / 100) || 0;
}

export function teamHandicaps(
	teams: readonly RoundTeam[],
	playingHandicaps: readonly number[],
): number[] {
	return teams.map((team) =>
		teamHandicap(team.playerIndexes.map((i) => playingHandicaps[i] ?? 0)),
	);
}

export interface TeamTotal {
	/** Over the holes every team has a result on, like `winner`. */
	strokes: number;
	net: number;
	vsPar: number;
	netVsPar: number;
	holesWon: number;
	/** Of those, the holes with strokes; a picked-up hole has none. */
	scored: number;
	/** Holes picked up: its total is not a full card. */
	pickedUp: number;
}

export interface ScrambleStanding {
	teams: TeamTotal[];
	/** Holes every team has a result on. */
	played: number;
	toPlay: number;
	/** Lower net over those holes; `null` when that can't be told. */
	winner: 0 | 1 | "tied" | null;
}

/** Team totals; with two teams also the holes each won on net. */
export function scrambleStanding(
	holes: ReadonlyArray<{ par: number }>,
	scores: ReadonlyArray<HoleScore>,
	received: ReadonlyArray<ReadonlyArray<number>>,
): ScrambleStanding {
	const holesWon = received.map(() => 0);
	let played = 0;
	const teams = received.map(() => ({
		strokes: 0,
		net: 0,
		vsPar: 0,
		netVsPar: 0,
		scored: 0,
		pickedUp: 0,
	}));
	holes.forEach(({ par }, holeIndex) => {
		const nets = holeNets(scores, holeIndex, received);
		if (!nets) return;
		played++;
		nets.forEach((net, i) => {
			const team = teams[i];
			if (net === null) {
				team.pickedUp++;
				return;
			}
			const strokes = net + (received[i][holeIndex] ?? 0);
			team.scored++;
			team.strokes += strokes;
			team.net += net;
			team.vsPar += strokes - par;
			team.netVsPar += net - par;
		});
		if (nets.length < 2) return;
		const best = Math.min(...nets.map(netRank));
		const winners = nets.flatMap((net, i) => (net === best ? [i] : []));
		if (best !== Infinity && winners.length === 1) holesWon[winners[0]]++;
	});
	return {
		teams: teams.map((team, i) => ({ ...team, holesWon: holesWon[i] })),
		played,
		toPlay: holes.length - played,
		winner: winnerOf(teams),
	};
}

/** A team that picked up has no total, so it can't win on strokes. */
function winnerOf(
	teams: ReadonlyArray<{ net: number; pickedUp: number }>,
): ScrambleStanding["winner"] {
	if (teams.length < 2) return null;
	const [a, b] = teams;
	if (a.pickedUp > 0 || b.pickedUp > 0) {
		if (a.pickedUp > 0 && b.pickedUp > 0) return null;
		return a.pickedUp > 0 ? 1 : 0;
	}
	if (a.net === b.net) return "tied";
	return a.net < b.net ? 0 : 1;
}
