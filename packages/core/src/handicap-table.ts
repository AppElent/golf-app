import { holeLabel } from "./format";
import { strokesPerHole } from "./scoring";

export interface HandicapTableRow {
	/** The hole as the course card names it. */
	hole: string;
	par: number;
	strokeIndex: number;
	/** Strokes per player, in player order; negative when given back. */
	strokes: number[];
}

/**
 * Which holes each player gets strokes on, in play order. A player without a
 * playing handicap gets none, as in scoring. `null` when there is nothing to
 * allocate over: no holes, or a hole without a stroke index or par (a stored
 * round reads a missing value as 0).
 */
export function handicapTable(
	holes: ReadonlyArray<{ ref: string; par?: number; strokeIndex?: number }>,
	players: ReadonlyArray<{ playingHandicap?: number }>,
): HandicapTableRow[] | null {
	const complete = holes.flatMap(({ ref, par, strokeIndex }) =>
		par && strokeIndex ? [{ ref, par, strokeIndex }] : [],
	);
	if (complete.length === 0 || complete.length < holes.length) return null;
	const perPlayer = players.map((player) =>
		strokesPerHole(complete, player.playingHandicap ?? 0),
	);
	return complete.map(({ ref, par, strokeIndex }, i) => ({
		hole: String(holeLabel(ref)),
		par,
		strokeIndex,
		strokes: perPlayer.map((strokes) => strokes[i]),
	}));
}
