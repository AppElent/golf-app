import type { Units } from "@fairway/core/format";
import type { LatLng } from "@fairway/core/geo";
import type { HoleAnchors } from "@fairway/core/hole-view";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import { fmt, useI18n } from "../../../i18n";
import { liveHolePosition, setLiveHole } from "../../live/hole/live-hole";
import { useBackgroundLocationWhilePlaying } from "../../location/background/background-location";
import { backgroundLocationPreferred } from "../../location/background/background-location-preference";
import { lockScreenHole } from "./play-model";

/**
 * Keeps the lock screen on this hole while playing: background tracking and the
 * Live Activity showing the current hole's distances. Never for a simulated
 * round (`enabled` off): the lock screen would show made-up distances.
 */
export function useLockScreenHole({
	anchors,
	meta,
	holeTitle,
	courseName,
	units,
	position,
	enabled,
}: {
	anchors: HoleAnchors | null;
	meta: { ref: string; par: number; strokeIndex: number } | undefined;
	holeTitle: string;
	courseName: string;
	units: Units;
	position: LatLng | null;
	enabled: boolean;
}) {
	const { t } = useI18n();
	useBackgroundLocationWhilePlaying(
		{ title: t.play.trackingTitle, body: t.play.trackingBody },
		enabled,
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: per hole and language
	useEffect(() => {
		if (!anchors || !meta || !enabled) return;
		setLiveHole(
			lockScreenHole({
				preferred: backgroundLocationPreferred(),
				anchors,
				title: holeTitle,
				holeRef: meta.ref,
				detail: `${fmt(t.play.holeMeta, { par: meta.par, si: meta.strokeIndex })} · ${courseName}`,
				units,
				labels: t.play,
				url: Linking.createURL("/play"),
			}),
		);
	}, [anchors, holeTitle, units, t, enabled]);
	useEffect(() => () => setLiveHole(null), []);
	// Real fixes only: the tee fallback would read as where the player stands.
	// biome-ignore lint/correctness/useExhaustiveDependencies: on a new fix only
	useEffect(() => {
		if (position && enabled) liveHolePosition(position, "foreground");
	}, [position?.lat, position?.lng]);
}
