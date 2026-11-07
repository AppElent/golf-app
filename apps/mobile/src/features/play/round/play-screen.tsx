/**
 * The on-course screen (Golfshot layout): the hole fills the screen, the
 * controls float over it in glass. Distances come from GPS, or from the tee
 * until there is a fix.
 */

import { type Club, DEFAULT_BAG } from "@fairway/core/club-suggest";
import { holeLabel, type Units } from "@fairway/core/format";
import type { LatLng } from "@fairway/core/geo";
import { learnedBag } from "@fairway/core/shots";
import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { fmt, useI18n } from "../../../i18n";
import { course, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import type { CourseDetail } from "../../courses/course-detail";
import { useWatchPosition } from "../../location/position/use-watch-position";
import { useUnits } from "../../profile/use-units";
import { NoActiveRound } from "../../rounds/components/no-active-round";
import {
	type ActiveRound,
	useActiveRound,
} from "../../rounds/use-active-round";
import { useSimulationMode } from "../../simulation/mode/use-simulation-mode";
import { hudLayout } from "../hud/hud-layout";
import { PlayBottomBar } from "./play-bottom-bar";
import { PlayClubTray } from "./play-club-tray";
import { PlayDistances } from "./play-distances";
import { PlayGpsPill } from "./play-gps-pill";
import { PlayHoleView } from "./play-hole-view";
import { gpsNotice, playerPosition } from "./play-model";
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
	const active = useActiveRound();
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
			key={active.round._id}
			active={active}
			detail={detail}
			bag={learnedBag(
				clubs && clubs.length > 0 ? clubs : DEFAULT_BAG,
				shots ?? [],
			)}
			units={units}
		/>
	);
}

function PlayHole({
	active,
	detail,
	bag,
	units,
}: {
	active: ActiveRound;
	detail: CourseDetail | null;
	bag: ReadonlyArray<Club>;
	units: Units;
}) {
	const { t } = useI18n();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { setSimulating } = useSimulationMode();

	const { round, holes } = active;
	const simulated = round.simulated === true;
	const watched = useWatchPosition(!simulated);
	const { holeIndex, goTo } = useCurrentHole(round);
	const meta = holes[holeIndex];
	const { geometry, anchors, nextAnchors, holeKey } = useHoleAnchors(
		round.holeRefs,
		detail,
		holeIndex,
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
	const { fix, player } = playerPosition(gps.position, anchors);

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
	const { holeShots, pendingShot, marking, onMarkShot, pickClub } =
		useShotMarking({
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
				hudTop={hudTop}
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
			/>
			{simulated ? (
				<PlaySimulationBanner
					top={hudTop + hudLayout.gpsPillTop}
					onExit={() => {
						setSimulating(false);
						router.back();
					}}
				/>
			) : null}
			<PlayGpsPill
				top={
					hudTop +
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
				top={hudTop + hudLayout.distancesTop}
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
			) : offerNext ? (
				<PlayNextTeeOffer
					bottom={hudBottom + hudLayout.trayBottom + simulationHeight}
					nextRef={round.holeRefs[holeIndex + 1] ?? ""}
					onDismiss={dismissOffer}
					onGo={() => goTo(holeIndex + 1)}
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
