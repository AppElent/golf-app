/**
 * The on-course screen (Golfshot layout): the hole fills the screen, the
 * controls float over it in glass. Distances come from GPS, or from the tee
 * until there is a fix.
 */

import { type Club, DEFAULT_BAG } from "@fairway/core/club-suggest";
import { holeLabel, type Units } from "@fairway/core/format";
import { learnedBag } from "@fairway/core/shots";
import { useKeepAwake } from "expo-keep-awake";
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
import { hudLayout } from "../hud/hud-layout";
import { PlayBottomBar } from "./play-bottom-bar";
import { PlayClubTray } from "./play-club-tray";
import { PlayDistances } from "./play-distances";
import { PlayGpsPill } from "./play-gps-pill";
import { PlayHoleView } from "./play-hole-view";
import { gpsNotice, playerPosition } from "./play-model";
import { PlayNextTeeOffer } from "./play-next-tee-offer";
import { PlayTopBar } from "./play-top-bar";
import { useCurrentHole } from "./use-current-hole";
import { useHoleAnchors } from "./use-hole-anchors";
import { useHoleState } from "./use-hole-state";
import { useHoleTarget } from "./use-hole-target";
import { useLockScreenHole } from "./use-lock-screen-hole";
import { useNextTeeOffer } from "./use-next-tee-offer";
import { useShotMarking } from "./use-shot-marking";

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
	const gps = useWatchPosition();

	const { round, holes } = active;
	const { holeIndex, goTo } = useCurrentHole(round);
	const meta = holes[holeIndex];
	const { geometry, anchors, nextAnchors, holeKey } = useHoleAnchors(
		round.holeRefs,
		detail,
		holeIndex,
	);
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

	return (
		<View style={styles.root}>
			<StatusBar style="light" />
			<PlayHoleView
				anchors={anchors}
				geometry={geometry}
				player={player}
				located={fix !== null}
				target={target}
				onTargetChange={setTarget}
				greenView={greenView}
				shots={holeShots}
				bag={bag}
				units={units}
				hudTop={hudTop}
				hudBottom={hudBottom}
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
			<PlayGpsPill
				top={hudTop + hudLayout.gpsPillTop}
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
				units={units}
			/>
			{pendingShot ? (
				<PlayClubTray
					bottom={hudBottom + hudLayout.trayBottom}
					bag={bag}
					onPick={pickClub}
				/>
			) : offerNext ? (
				<PlayNextTeeOffer
					bottom={hudBottom + hudLayout.trayBottom}
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
