import { useCallback } from "react";
import { useI18n } from "../../../i18n";
import { useToast } from "../../../ui/toast";
import { useSimulationMode } from "./use-simulation-mode";

/** Leave simulation mode and say so: whatever the exit, nothing was saved. */
export function useEndSimulation() {
	const { setSimulating } = useSimulationMode();
	const toast = useToast();
	const ended = useI18n().t.simulator.ended;
	return useCallback(() => {
		setSimulating(false);
		toast.success(ended);
	}, [setSimulating, toast, ended]);
}
