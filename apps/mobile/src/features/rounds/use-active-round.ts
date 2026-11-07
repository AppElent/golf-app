import { api } from "../../convex/api";
import { useQuery } from "../../convex/query-cache";

export type ActiveRound = NonNullable<ReturnType<typeof useActiveRound>>;

/** `undefined` while loading, `null` when no round is in progress. */
export function useActiveRound() {
	return useQuery(api.rounds.active);
}
