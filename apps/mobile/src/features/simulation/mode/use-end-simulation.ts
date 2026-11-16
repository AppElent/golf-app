import { useCallback } from "react";
import { useI18n } from "../../../i18n";
import { useToast } from "../../../ui/toast";
import { useSimulationMode } from "./use-simulation-mode";

/**
 * Leave simulation mode and say so. `ended`: the simulated round is gone.
 * `paused`: it stays on the server, resumable from the course simulator.
 * Either way nothing was saved.
 */
export function useEndSimulation() {
	const { setSimulating } = useSimulationMode();
	const toast = useToast();
	const { ended, paused } = useI18n().t.simulator;
	return useCallback(
		(how: "ended" | "paused" = "ended") => {
			setSimulating(false);
			toast.success(how === "ended" ? ended : paused);
		},
		[setSimulating, toast, ended, paused],
	);
}
