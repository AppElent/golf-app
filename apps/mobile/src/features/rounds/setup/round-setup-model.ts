/** Add a loop pick; at most two picks (18 holes), the same loop twice is fine. */
export function toggleLoopPick(picks: readonly number[], index: number) {
	return picks.length >= 2 ? [index] : [...picks, index];
}
