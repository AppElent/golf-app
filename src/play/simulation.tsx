import type { LatLng } from "@fairway/core/geo";
import type { HoleAnchors } from "@fairway/core/hole-view";
import {
	type SimulationSpot,
	simulationSpot,
	WALK_STEP_MS,
	walkStep,
} from "@fairway/core/simulation";
import { useQuery } from "convex/react";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { api } from "../../convex/_generated/api";

const STORAGE_KEY = "fairway.simulating";

interface SimulationMode {
	simulating: boolean;
	setSimulating: (on: boolean) => void;
}

const SimulationModeContext = createContext<SimulationMode>({
	simulating: false,
	setSimulating: () => {},
});

function storedMode(): boolean {
	try {
		return window.sessionStorage.getItem(STORAGE_KEY) === "1";
	} catch {
		return false;
	}
}

/** Per tab and gone with it: a new session is back in the real round. */
export function SimulationModeProvider({ children }: { children: ReactNode }) {
	const [simulating, setMode] = useState(false);
	useEffect(() => setMode(storedMode()), []);
	const value = useMemo(
		() => ({
			simulating,
			setSimulating: (on: boolean) => {
				setMode(on);
				try {
					window.sessionStorage.setItem(STORAGE_KEY, on ? "1" : "0");
				} catch {
					// The mode lasts until a reload instead.
				}
			},
		}),
		[simulating],
	);
	return (
		<SimulationModeContext.Provider value={value}>
			{children}
		</SimulationModeContext.Provider>
	);
}

export function useSimulationMode() {
	return useContext(SimulationModeContext);
}

/** The round being played: in simulation mode, the simulated one. */
export function useActiveRound() {
	const { simulating } = useSimulationMode();
	const real = useQuery(api.rounds.active, simulating ? "skip" : {});
	const simulated = useQuery(
		api.rounds.activeSimulation,
		simulating ? {} : "skip",
	);
	return simulating ? simulated : real;
}

/** Where simulation mode stands the player: on this hole's tee to begin with. */
export function useSimulatedPosition(
	holeRef: string,
	anchors: HoleAnchors | null,
	holeLine: ReadonlyArray<LatLng> | undefined,
) {
	const [state, setState] = useState<{
		holeRef: string;
		position: LatLng | null;
	}>({ holeRef, position: anchors?.tee ?? null });
	const [walking, setWalking] = useState(false);
	const [moving, setMoving] = useState(false);

	// Back on the tee as soon as play moves to another hole, or when the course
	// data arrives after the round does.
	let current = state;
	if (state.holeRef !== holeRef || (!state.position && anchors)) {
		current = { holeRef, position: anchors?.tee ?? null };
		setState(current);
		setWalking(false);
	}
	const moveTo = (position: LatLng) => setState({ holeRef, position });

	const green = anchors?.green;
	useEffect(() => {
		if (!walking || !green) return;
		const timer = setInterval(() => {
			setState((prev) =>
				prev.position
					? { ...prev, position: walkStep(prev.position, green, holeLine) }
					: prev,
			);
		}, WALK_STEP_MS);
		return () => clearInterval(timer);
	}, [walking, green, holeLine]);

	const arrived =
		!!green &&
		current.position?.lat === green.lat &&
		current.position?.lng === green.lng;
	if (walking && arrived) setWalking(false);

	return {
		position: current.position,
		walking,
		moving,
		setMoving,
		setWalking,
		moveTo,
		jump: (spot: SimulationSpot) => {
			if (!anchors) return;
			setWalking(false);
			moveTo(simulationSpot(spot, anchors, holeLine));
		},
	};
}
