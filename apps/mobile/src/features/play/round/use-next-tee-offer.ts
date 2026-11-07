import type { LatLng } from "@fairway/core/geo";
import { shouldAdvance } from "@fairway/core/hole-advance";
import type { HoleAnchors } from "@fairway/core/hole-view";
import { useState } from "react";

/** Offered once per hole until dismissed; it never moves on by itself. */
export function useNextTeeOffer({
	position,
	accuracyMeters,
	anchors,
	nextAnchors,
	holeIndex,
}: {
	position: LatLng | null;
	accuracyMeters: number | null;
	anchors: HoleAnchors | null;
	nextAnchors: HoleAnchors | null;
	holeIndex: number;
}) {
	const [dismissedOffer, setDismissedOffer] = useState<number | null>(null);
	const offerNext =
		!!position &&
		!!anchors &&
		dismissedOffer !== holeIndex &&
		shouldAdvance(
			position,
			anchors,
			nextAnchors ?? undefined,
			accuracyMeters ?? 0,
		);
	return { offerNext, dismissOffer: () => setDismissedOffer(holeIndex) };
}
