import {
	type HoleScore,
	holeNets,
	netRank,
	playerStrokes,
	type RoundTeam,
} from "./round";
import { totalStrokes, vsPar } from "./scoring";

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
	/** Over the holes with strokes. */
	strokes: number;
	net: number;
	vsPar: number;
	netVsPar: number;
	/** Holes with strokes; a picked-up hole has none. */
	scored: number;
	holesWon: number;
}

export interface ScrambleStanding {
	teams: TeamTotal[];
	/** Holes every team has a result on. */
	played: number;
	toPlay: number;
}

/** Team totals; with two teams also the holes each won on net. */
export function scrambleStanding(
	holes: ReadonlyArray<{ par: number }>,
	scores: ReadonlyArray<HoleScore>,
	received: ReadonlyArray<ReadonlyArray<number>>,
): ScrambleStanding {
	const holesWon = received.map(() => 0);
	let played = 0;
	holes.forEach((_, holeIndex) => {
		const nets = holeNets(scores, holeIndex, received);
		if (!nets) return;
		played++;
		if (nets.length < 2) return;
		const best = Math.min(...nets.map(netRank));
		const winners = nets.flatMap((net, i) => (net === best ? [i] : []));
		if (best !== Infinity && winners.length === 1) holesWon[winners[0]]++;
	});
	const teams = received.map((teamReceived, team) => {
		const strokes = playerStrokes(holes.length, scores, team);
		const given = strokes.reduce<number>(
			(sum, s, i) => (s === null ? sum : sum + (teamReceived[i] ?? 0)),
			0,
		);
		const total = totalStrokes(strokes);
		const toPar = vsPar(holes, strokes);
		return {
			strokes: total,
			net: total - given,
			vsPar: toPar,
			netVsPar: toPar - given,
			scored: strokes.filter((s) => s !== null).length,
			holesWon: holesWon[team],
		};
	});
	return { teams, played, toPlay: holes.length - played };
}
