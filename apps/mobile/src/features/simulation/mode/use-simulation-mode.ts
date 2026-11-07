import { createContext, useContext } from "react";

interface SimulationMode {
	/** The app plays the simulated round rather than the real one. */
	simulating: boolean;
	setSimulating: (on: boolean) => void;
}

export const SimulationModeContext = createContext<SimulationMode>({
	simulating: false,
	setSimulating: () => {},
});

export function useSimulationMode() {
	return useContext(SimulationModeContext);
}
