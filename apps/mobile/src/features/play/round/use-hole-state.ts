import { type SetStateAction, useCallback, useState } from "react";

/**
 * State that belongs to one hole: back to `initial` as soon as play moves to
 * another. The reset happens during render, so no frame shows the last hole's
 * value on the new hole.
 */
export function useHoleState<T>(holeKey: string, initial: () => T) {
	const [state, setState] = useState(() => ({ holeKey, value: initial() }));
	let current = state;
	if (state.holeKey !== holeKey) {
		current = { holeKey, value: initial() };
		setState(current);
	}
	// A late write (a slow mutation resolving) lands on the hole now in play.
	const setValue = useCallback((next: SetStateAction<T>) => {
		setState((prev) => ({
			holeKey: prev.holeKey,
			value:
				typeof next === "function"
					? (next as (value: T) => T)(prev.value)
					: next,
		}));
	}, []);
	return [current.value, setValue] as const;
}
