import { type ReactNode, useMemo, useState } from "react";
import { SimulationModeContext } from "./use-simulation-mode";

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
