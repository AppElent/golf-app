import { useEffect } from "react";
import { api } from "../../convex/api";
import { useQuery } from "../../convex/query-cache";
import { useSimulationMode } from "../simulation/mode/use-simulation-mode";

export type ActiveRound = NonNullable<ReturnType<typeof useActiveRound>>;

/** The round being played: in simulation mode, the simulated one. `undefined`
 *  while loading, `null` when no round is in progress. */
export function useActiveRound() {
	const { simulating, setSimulating } = useSimulationMode();
	const real = useQuery(api.rounds.active, simulating ? "skip" : {});
	const simulated = useQuery(
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
