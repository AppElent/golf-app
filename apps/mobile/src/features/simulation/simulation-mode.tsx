import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";

interface SimulationMode {
	/** The app plays the simulated round rather than the real one. */
	simulating: boolean;
	setSimulating: (on: boolean) => void;
}

const SimulationModeContext = createContext<SimulationMode>({
	simulating: false,
	setSimulating: () => {},
});

/** In memory on purpose: a restarted app is back in the real round. */
export function SimulationModeProvider({ children }: { children: ReactNode }) {
	const [simulating, setSimulating] = useState(false);
	const value = useMemo(() => ({ simulating, setSimulating }), [simulating]);
	return (
		<SimulationModeContext.Provider value={value}>
			{children}
		</SimulationModeContext.Provider>
	);
}

export function useSimulationMode() {
	return useContext(SimulationModeContext);
}
