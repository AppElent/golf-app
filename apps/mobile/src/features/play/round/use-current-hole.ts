import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/api";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import { useToast } from "../../../ui/toast";
import type { ActiveRound } from "../../rounds/use-active-round";

/**
 * The current hole lives on the server so the web and a second phone agree;
 * this screen moves at once and reports a failed write.
 */
export function useCurrentHole(round: ActiveRound["round"]) {
	const { t } = useI18n();
	const toast = useToast();
	const setCurrentHole = useMutation(api.rounds.setCurrentHole);
	const [holeIndex, setHoleIndex] = useState(round.currentHoleIndex);
	// The hole this screen asked the server for, until the server has it:
	// acks of earlier taps must not snap the screen back.
	const requestedHole = useRef<number | null>(null);
	useEffect(() => {
		const server = round.currentHoleIndex;
		if (requestedHole.current !== null && requestedHole.current !== server) {
			return;
		}
		requestedHole.current = null;
		setHoleIndex(server);
	}, [round.currentHoleIndex]);

	function goTo(next: number) {
		if (next < 0 || next >= round.holeRefs.length) return;
		haptics.selectionChanged();
		setHoleIndex(next);
		requestedHole.current = next;
		setCurrentHole({ roundId: round._id, holeIndex: next }).catch(() => {
			requestedHole.current = null;
			toast.error(t.play.holeError);
		});
	}

	return { holeIndex, goTo };
}
