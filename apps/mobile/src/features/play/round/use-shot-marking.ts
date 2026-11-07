import type { LatLng } from "@fairway/core/geo";
import { useMutation } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import { useToast } from "../../../ui/toast";
import { useHoleState } from "./use-hole-state";

/**
 * Marking saves the ball's position (server ack = saved) and then asks for the
 * club, which is what learns club distances.
 */
export function useShotMarking({
	roundId,
	holeIndex,
	holeKey,
	fix,
	onMarked,
}: {
	roundId: Id<"rounds">;
	holeIndex: number;
	holeKey: string;
	fix: LatLng | null;
	onMarked: (position: LatLng) => void;
}) {
	const { t } = useI18n();
	const toast = useToast();
	const markShot = useMutation(api.shots.mark);
	const setShotClub = useMutation(api.shots.setClub);
	const allShots = useQuery(api.shots.forRound, { roundId });
	const holeShots = useMemo(
		() =>
			(allShots ?? [])
				.filter((shot) => shot.holeIndex === holeIndex)
				.map((shot) => shot.position),
		[allShots, holeIndex],
	);
	const [pendingShot, setPendingShot] = useHoleState<Id<"shots"> | null>(
		holeKey,
		() => null,
	);
	const [marking, setMarking] = useState(false);
	const holeInPlay = useRef(holeKey);
	useEffect(() => {
		holeInPlay.current = holeKey;
	}, [holeKey]);

	/** True if the shot was saved and play is still on its hole. */
	async function onMarkShot() {
		if (!fix) {
			toast.error(t.play.markNeedsGps);
			return false;
		}
		setMarking(true);
		try {
			const shotId = await markShot({ roundId, holeIndex, position: fix });
			haptics.saveConfirmed();
			setPendingShot(shotId);
			// A slow ack can land after play moved on: this aim was for the old hole.
			const stillOnHole = holeInPlay.current === holeKey;
			if (stillOnHole) onMarked(fix);
			return stillOnHole;
		} catch {
			toast.error(t.play.markError);
			return false;
		} finally {
			setMarking(false);
		}
	}

	function pickClub(club: string | undefined) {
		const shotId = pendingShot;
		setPendingShot(null);
		if (!shotId || club === undefined) return;
		haptics.selectionChanged();
		setShotClub({ shotId, club }).catch(() => toast.error(t.play.markError));
	}

	return { holeShots, pendingShot, marking, onMarkShot, pickClub };
}
