import { api } from "../../convex/api";
import { useQuery } from "../../convex/query-cache";
import { useSimulationMode } from "../simulation/simulation-mode";

export type ActiveRound = NonNullable<ReturnType<typeof useActiveRound>>;

/** The round being played: in simulation mode, the simulated one. `undefined`
 *  while loading, `null` when no round is in progress. */
export function useActiveRound() {
	const { simulating } = useSimulationMode();
	const real = useQuery(api.rounds.active, simulating ? "skip" : {});
	const simulated = useQuery(
		api.rounds.activeSimulation,
		simulating ? {} : "skip",
	);
	return simulating ? simulated : real;
}
