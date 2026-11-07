import { DEFAULT_UNITS, type Units } from "@fairway/core/format";
import { api } from "../../convex/api";
import { useQuery } from "../../convex/query-cache";

export function useUnits(): Units {
	return useQuery(api.settings.get)?.units ?? DEFAULT_UNITS;
}
