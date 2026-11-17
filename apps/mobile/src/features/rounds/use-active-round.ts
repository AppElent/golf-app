import { useEffect } from "react";
import { api } from "../../convex/api";
import { useLiveQuery, useQuery } from "../../convex/query-cache";
import { useSimulationMode } from "../simulation/mode/use-simulation-mode";

export type ActiveRound = NonNullable<ReturnType<typeof useActiveRound>>;

type RoundQuery = typeof useLiveQuery;

/** The round being played: in simulation mode, the simulated one. `undefined`
 *  while loading, `null` when no round is in progress. Live: for screens that
 *  seed a form or decide a write from it (scores, scorecard, Home). */
export function useActiveRound() {
	return useActiveRoundWith(useLiveQuery);
}

/** The same, for the play screen's display: the real round may come from the
 *  last-known copy until the live answer arrives (APP-146). */
export function useDisplayedActiveRound() {
	return useActiveRoundWith(useQuery as RoundQuery);
}

function useActiveRoundWith(useRoundQuery: RoundQuery) {
	const { simulating, setSimulating } = useSimulationMode();
	const real = useRoundQuery(api.rounds.active, simulating ? "skip" : {});
	const simulated = useLiveQuery(
		api.rounds.activeSimulation,
		simulating ? {} : "skip",
	);
	// Finished elsewhere, or its course is gone: back to the real round.
	const gone = simulating && simulated === null;
	useEffect(() => {
		if (gone) setSimulating(false);
	}, [gone, setSimulating]);
	return simulating ? (simulated ?? undefined) : real;
}
