/**
 * The on-course screen (Golfshot layout): the hole fills the screen, the
 * controls float over it in glass. Distances come from GPS, or from the tee
 * until there is a fix.
 */

import { type Club, effectiveBag } from "@fairway/core/club-suggest";
import { holeLabel, type Units } from "@fairway/core/format";
import type { LatLng } from "@fairway/core/geo";
import { learnedBag } from "@fairway/core/shots";
import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { course, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import type { CourseDetail } from "../../courses/course-detail";
import { useWatchPosition } from "../../location/position/use-watch-position";
import { useUnits } from "../../profile/use-units";
import { NoActiveRound } from "../../rounds/components/no-active-round";
import { useGame } from "../../rounds/formats/use-game";
import {
	type ActiveRound,
	useActiveRound,
	useDisplayedActiveRound,
} from "../../rounds/use-active-round";
import { useEndSimulation } from "../../simulation/mode/use-end-simulation";
import { hudLayout } from "../hud/hud-layout";
import { PlayBottomBar } from "./play-bottom-bar";
import { PlayClubTray } from "./play-club-tray";
import { PlayDistances } from "./play-distances";
import { PlayGameCapsule } from "./play-game-capsule";
import { PlayGpsPill } from "./play-gps-pill";
import { PlayHoleView } from "./play-hole-view";
import {
	gpsNotice,
	nextTeeAction,
	nextTeeHole,
	playerPosition,
} from "./play-model";
import { PlayNextTeeOffer } from "./play-next-tee-offer";
import { PlaySimulationBanner } from "./play-simulation-banner";
import { PlaySimulationControls } from "./play-simulation-controls";
import { PlayTopBar } from "./play-top-bar";
import { useCurrentHole } from "./use-current-hole";
import { useHoleAnchors } from "./use-hole-anchors";
import { useHoleState } from "./use-hole-state";
import { useHoleTarget } from "./use-hole-target";
import { useLockScreenHole } from "./use-lock-screen-hole";
import { useNextTeeOffer } from "./use-next-tee-offer";
import { useShotMarking } from "./use-shot-marking";
import {
	SIMULATED_ACCURACY_M,
	useSimulatedPosition,
} from "./use-simulated-position";

export function PlayScreen() {
	useKeepAwake();
	const { t } = useI18n();
	// Writes (hole changes, marked shots) only ever start from the live round.
	// Until it arrives, the saved copy is drawn display-only, like offline.
	const live = useActiveRound();
	const displayed = useDisplayedActiveRound();
	const fromCopy = live === undefined && !!displayed;
	const active = live !== undefined ? live : displayed;
	const detail = useQuery(
		api.courses.get,
		active ? { courseId: active.round.courseId } : "skip",
	);
	const clubs = useQuery(api.clubs.list);
	const units = useUnits();
	const shots = useQuery(api.shots.mine);

	if (active === null) {
		return (
			<View style={styles.empty}>
				<NoActiveRound title={t.play.noRound} closeLabel={t.play.close} />
			</View>
		);
	}
	if (active === undefined || detail === undefined) {
		return (
			<View style={styles.empty}>
				<StatusBar style="light" />
				<AppText style={styles.loading}>{t.play.loading}</AppText>
			</View>
		);
	}
	return (
		<PlayHole
			key={`${fromCopy ? "copy" : "live"}:${active.round._id}`}
			active={active}
			offline={fromCopy}
			detail={detail}
			bag={learnedBag(effectiveBag(clubs ?? []), shots ?? [])}
			units={units}
		/>
	);
}

/**
 * How the hole screen talks to the server. Live: the current hole and marked
 * shots are saved. Offline (the session gate's fallback, APP-146): the hole
 * moves on this phone only and nothing is written. Chosen once per mount, so
 * the hooks behind it never change between renders.
 */
const LIVE = { useHole: useCurrentHole, useMarking: useShotMarking };
const OFFLINE = { useHole: useLocalHole, useMarking: useNoShotMarking };

/** Offline: move between holes on this phone, with no server write. */
function useLocalHole(round: ActiveRound["round"]) {
	const [holeIndex, setHoleIndex] = useState(round.currentHoleIndex);
	function goTo(next: number) {
		if (next < 0 || next >= round.holeRefs.length) return;
		haptics.selectionChanged();
		setHoleIndex(next);
	}
	return { holeIndex, goTo };
}

const NO_SHOTS: LatLng[] = [];

/** Offline: no shots to show and none to mark. */
function useNoShotMarking(_: Parameters<typeof useShotMarking>[0]) {
	return {
		holeShots: NO_SHOTS,
		pendingShot: null,
		marking: false,
		onMarkShot: async () => false,
		pickClub: (_club: string | undefined) => {},
	};
}

export function PlayHole({
	active,
	detail,
	bag,
	units,
	offline = false,
}: {
	active: ActiveRound;
	detail: CourseDetail | null;
	bag: ReadonlyArray<Club>;
	units: Units;
	/** Drawn from the saved copy without a connection: display only. */
	offline?: boolean;
}) {
	const { t } = useI18n();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const endSimulation = useEndSimulation();
	const game = useGame();

	const { round, holes } = active;
	const simulated = round.simulated === true;
	const watched = useWatchPosition(!simulated);
	const [{ useHole, useMarking }] = useState(() => (offline ? OFFLINE : LIVE));
	const { holeIndex, goTo } = useHole(round);
	const meta = holes[holeIndex];
	const nextIndex = nextTeeHole(
		round.holeRefs.length,
		active.scores,
		holeIndex,
		round.startHoleIndex,
	);
	const { geometry, anchors, nextAnchors, holeKey } = useHoleAnchors(
		round.holeRefs,
		detail,
		holeIndex,
		nextIndex,
		active.tee.marker,
	);
	const sim = useSimulatedPosition({
		holeKey,
		anchors,
		geometry,
		nextAnchors,
	});
	const gps = simulated
		? { position: sim.position, accuracyMeters: SIMULATED_ACCURACY_M }
		: watched;
	const { fix, player } = playerPosition(gps.position, anchors, simulated);

	const holeNumber = meta ? holeLabel(meta.ref) : holeIndex + 1;
	const holeTitle = fmt(t.play.hole, { n: holeNumber });
	useLockScreenHole({
		anchors,
		meta,
		holeTitle,
		courseName: active.course.name,
		units,
		position: gps.position,
		enabled: !simulated,
	});
	const { target, setTarget, aimFrom } = useHoleTarget({
		holeKey,
		anchors,
		player,
		fix,
		bag,
	});
	const { holeShots, pendingShot, marking, onMarkShot, pickClub } = useMarking({
		roundId: round._id,
		holeIndex,
		holeKey,
		fix,
		onMarked: aimFrom,
	});
	const { offerNext, dismissOffer } = useNextTeeOffer({
		position: gps.position,
		accuracyMeters: gps.accuracyMeters,
		anchors,
		nextAnchors,
		holeIndex,
	});

	const [greenView, setGreenView] = useHoleState(holeKey, () => false);

	const hudTop = insets.top + spacing.sm;
	const hudBottom = insets.bottom + spacing.md;
	// Off a game there is no capsule, and nothing moves.
	const gameStanding = game(round, holes, active.scores).capsule(holeIndex);
	const hudStack = hudTop + (gameStanding ? hudLayout.gameCapsule : 0);
	const simulationHeight = simulated ? hudLayout.simulationPanel : 0;

	/** Simulation mode: stand somewhere else and aim from there. */
	function standAt(position: LatLng | null) {
		if (!position) return;
		sim.stopWalking();
		sim.moveTo(position);
		aimFrom(position);
	}

	/** Simulation mode: the shot goes exactly where it was aimed. */
	async function hit() {
		const landed = target;
		if (!landed) return;
		sim.stopWalking();
		if (await onMarkShot()) standAt(landed);
	}

	return (
		<View style={styles.root}>
			<StatusBar style="light" />
			<PlayHoleView
				anchors={anchors}
				geometry={geometry}
				player={player}
				located={fix !== null}
				target={target}
				onTargetChange={simulated && sim.moving ? standAt : setTarget}
				greenView={greenView}
				shots={holeShots}
				bag={bag}
				units={units}
				// The simulation banner hangs below the top bar: frame the hole
				// under it too, as the bottom does for the simulation panel.
				hudTop={hudStack + (simulated ? hudLayout.gpsPillBelowBanner : 0)}
				hudBottom={hudBottom + simulationHeight}
			/>
			<PlayTopBar
				top={hudTop}
				title={holeTitle}
				meta={meta}
				holeIndex={holeIndex}
				holeCount={round.holeRefs.length}
				units={units}
				onGoTo={goTo}
				offline={offline}
			/>
			{gameStanding ? (
				<PlayGameCapsule
					top={hudTop + hudLayout.gpsPillTop}
					text={gameStanding}
				/>
			) : null}
			{simulated ? (
				<PlaySimulationBanner
					top={hudStack + hudLayout.gpsPillTop}
					onExit={() => {
						endSimulation("paused");
						router.back();
					}}
				/>
			) : null}
			<PlayGpsPill
				top={
					hudStack +
					hudLayout.gpsPillTop +
					(simulated ? hudLayout.gpsPillBelowBanner : 0)
				}
				notice={gpsNotice({
					hasAnchors: !!anchors,
					located: fix !== null,
					hasFix: !!gps.position,
					accuracyMeters: gps.accuracyMeters,
				})}
			/>
			<PlayDistances
				top={hudStack + hudLayout.distancesTop}
				anchors={anchors}
				player={player}
				geometry={greenView ? null : geometry}
				units={units}
			/>
			{simulated ? (
				<PlaySimulationControls
					bottom={hudBottom + hudLayout.trayBottom}
					hasNextTee={sim.nextTee !== null}
					walking={sim.walking}
					moving={sim.moving}
					busy={marking || !!pendingShot}
					onTee={() => standAt(sim.spot("tee"))}
					onApproach={() => standAt(sim.spot("approach"))}
					onGreen={() => standAt(sim.spot("green"))}
					onNextTee={() => standAt(sim.nextTee)}
					onToggleMove={() => sim.setMoving((on) => !on)}
					onToggleWalk={sim.toggleWalking}
					onHit={() => void hit()}
				/>
			) : null}
			{pendingShot ? (
				<PlayClubTray
					bottom={hudBottom + hudLayout.trayBottom + simulationHeight}
					bag={bag}
					onPick={pickClub}
				/>
			) : offerNext && nextIndex !== null ? (
				<PlayNextTeeOffer
					bottom={hudBottom + hudLayout.trayBottom + simulationHeight}
					nextRef={round.holeRefs[nextIndex] ?? ""}
					unscoredRef={
						!offline && nextTeeAction(active.scores, holeIndex) === "score"
							? (round.holeRefs[holeIndex] ?? null)
							: null
					}
					onDismiss={dismissOffer}
					onGo={() => goTo(nextIndex)}
					onScore={() =>
						router.push({
							pathname: "/score",
							params: { hole: String(holeIndex) },
						})
					}
				/>
			) : null}
			<PlayBottomBar
				bottom={hudBottom}
				holeIndex={holeIndex}
				holeNumber={holeNumber}
				hasAnchors={!!anchors}
				greenView={greenView}
				onToggleGreenView={() => setGreenView((v) => !v)}
				marking={marking}
				onMarkShot={() => void onMarkShot()}
				offline={offline}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: course.rough },
	empty: {
		flex: 1,
		backgroundColor: course.rough,
		alignItems: "center",
		justifyContent: "center",
		padding: spacing.lg,
	},
	loading: { color: course.hudTextMuted },
});
