/**
 * The on-course screen (Golfshot layout): the hole fills the screen, the
 * controls float over it in glass. Top: close · hole switcher · scorecard.
 * Right: Back / CENTER / Front. Bottom: hole/green view · Score · mark shot.
 *
 * Distances come from GPS, or from the tee until there is a fix. The current
 * hole lives on the server (`rounds.setCurrentHole`) so the web and a second
 * phone agree; the screen moves at once and reports a failed write.
 *
 * Marking a shot saves the ball's position (server ack = saved) and then asks
 * for the club, which is what learns club distances. Standing on the next
 * tee offers the next hole; it never moves on by itself.
 */

import { DEFAULT_BAG } from "@fairway/core/club-suggest";
import { holeLabel } from "@fairway/core/format";
import { haversineMeters, type LatLng } from "@fairway/core/geo";
import { shouldAdvance } from "@fairway/core/hole-advance";
import {
	greenNumbers,
	type HazardInPlay,
	hazardsInPlay,
	holeAnchors,
} from "@fairway/core/hole-view";
import { learnedBag } from "@fairway/core/shots";
import { useMutation } from "convex/react";
import { useKeepAwake } from "expo-keep-awake";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Doc, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { course, spacing, type as typeRamp } from "../../../theme";
import { EmptyState } from "../../../ui/empty-state";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { liveHolePosition, setLiveHole } from "../../live/live-hole";
import {
	backgroundLocationPreferred,
	useBackgroundLocationWhilePlaying,
} from "../../location/background/background-location";
import { useWatchPosition } from "../../location/position/use-watch-position";
import { HoleCanvas, hasSatellite } from "../hole/hole-canvas";
import { HudButton } from "../hud/hud-button";
import { HudGlass } from "../hud/hud-glass";
import {
	defaultTarget,
	distanceNumber,
	isOnHole,
	legLabel,
} from "./play-model";

type Active = NonNullable<
	ReturnType<typeof useQuery<typeof api.rounds.active>>
>;
type CourseDetail = NonNullable<
	ReturnType<typeof useQuery<typeof api.courses.get>>
>;

export function PlayScreen() {
	useKeepAwake();
	const { t } = useI18n();
	const router = useRouter();
	const active = useQuery(api.rounds.active);
	const detail = useQuery(
		api.courses.get,
		active ? { courseId: active.round.courseId } : "skip",
	);
	const clubs = useQuery(api.clubs.list);
	const settings = useQuery(api.settings.get);
	// Suggestions use what you actually hit once a club has enough shots.
	const shots = useQuery(api.shots.mine);

	if (active === null) {
		return (
			<View style={styles.empty}>
				<EmptyState
					title={t.play.noRound}
					body={t.play.noRoundHint}
					action={{ label: t.play.close, onPress: () => router.back() }}
				/>
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
			units={settings?.units ?? "m"}
		/>
	);
}

function PlayHole({
	active,
	detail,
	bag,
	units,
}: {
	active: Active;
	detail: CourseDetail | null;
	bag: ReadonlyArray<Pick<Doc<"clubs">, "name" | "carryMeters">>;
	units: "m" | "yd";
}) {
	const { t } = useI18n();
	const router = useRouter();
	const toast = useToast();
	const insets = useSafeAreaInsets();
	const setCurrentHole = useMutation(api.rounds.setCurrentHole);
	const markShot = useMutation(api.shots.mark);
	const setShotClub = useMutation(api.shots.setClub);
	const gps = useWatchPosition();
	useBackgroundLocationWhilePlaying({
		title: t.play.trackingTitle,
		body: t.play.trackingBody,
	});

	const { round, holes } = active;
	const allShots = useQuery(api.shots.forRound, { roundId: round._id });
	const [holeIndex, setHoleIndex] = useState(round.currentHoleIndex ?? 0);
	// The hole this screen asked the server for, until the server has it:
	// acks of earlier taps must not snap the screen back.
	const requestedHole = useRef<number | null>(null);
	// Follow the server when the score sheet or another device moves on.
	useEffect(() => {
		const server = round.currentHoleIndex ?? 0;
		if (requestedHole.current !== null && requestedHole.current !== server) {
			return;
		}
		requestedHole.current = null;
		setHoleIndex(server);
	}, [round.currentHoleIndex]);

	const [greenView, setGreenView] = useState(false);
	const [mode] = useState<"satellite" | "schematic">(
		hasSatellite ? "satellite" : "schematic",
	);

	const ref = round.holeRefs[holeIndex];
	const meta = holes[holeIndex];
	const geometry = detail?.geometry.find((g) => g.ref === ref) ?? null;
	const anchors = useMemo(
		() =>
			geometry
				? holeAnchors({ ...geometry, holeLine: geometry.holeLine ?? [] })
				: null,
		[geometry],
	);
	const nextRef = round.holeRefs[holeIndex + 1];
	const nextGeometry =
		nextRef === undefined
			? null
			: (detail?.geometry.find((g) => g.ref === nextRef) ?? null);
	const nextAnchors = useMemo(
		() =>
			nextGeometry
				? holeAnchors({
						...nextGeometry,
						holeLine: nextGeometry.holeLine ?? [],
					})
				: null,
		[nextGeometry],
	);
	const holeShots = useMemo(
		() =>
			(allShots ?? [])
				.filter((shot) => shot.holeIndex === holeIndex)
				.map((shot) => shot.position),
		[allShots, holeIndex],
	);

	// GPS counts only on (or near) this hole; at home it would draw a line
	// across the country.
	const located =
		!!gps.position && !!anchors && isOnHole(gps.position, anchors);
	const player: LatLng | null = anchors
		? located && gps.position
			? gps.position
			: anchors.tee
		: null;

	// Lock-screen distances (a Live Activity) while "GPS while locked" is on.
	const holeTitle = fmt(t.play.hole, {
		n: meta ? holeLabel(meta.ref) : holeIndex + 1,
	});
	// biome-ignore lint/correctness/useExhaustiveDependencies: per hole and language
	useEffect(() => {
		if (!anchors || !meta) return;
		setLiveHole(
			{
				anchors,
				props: {
					hole: holeTitle,
					holeShort: holeLabel(meta.ref),
					detail: `${fmt(t.play.holeMeta, { par: meta.par, si: meta.strokeIndex })} · ${active.course.name}`,
					unit: units,
					frontLabel: t.play.front,
					centerLabel: t.play.center,
					backLabel: t.play.back,
				},
				format: (m) => distanceNumber(m, units),
				url: Linking.createURL("/play"),
			},
			backgroundLocationPreferred(),
		);
	}, [anchors, holeTitle, units, t]);
	useEffect(() => () => setLiveHole(null, false), []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: on a new fix only
	useEffect(() => {
		if (player) liveHolePosition(player, true);
	}, [player?.lat, player?.lng]);

	// Shot just marked, waiting for its club (null: no strip).
	const [pendingShot, setPendingShot] = useState<Id<"shots"> | null>(null);
	const [marking, setMarking] = useState(false);
	const [target, setTarget] = useState<LatLng | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset per hole only
	useEffect(() => {
		setTarget(
			anchors && player ? defaultTarget(player, anchors.green, bag) : null,
		);
		setGreenView(false);
		setPendingShot(null);
	}, [ref, anchors?.green.lat, anchors?.green.lng]);
	// The first fix on the hole: aim from the ball, not from the tee (Play
	// opened mid-hole would otherwise draw the line backwards).
	// biome-ignore lint/correctness/useExhaustiveDependencies: on gaining a fix only
	useEffect(() => {
		if (located && anchors && gps.position) {
			setTarget(defaultTarget(gps.position, anchors.green, bag));
		}
	}, [located]);

	async function onMarkShot() {
		if (!located || !gps.position) {
			toast.error(t.play.markNeedsGps);
			return;
		}
		setMarking(true);
		try {
			const shotId = await markShot({
				roundId: round._id,
				holeIndex,
				position: gps.position,
			});
			haptics.entryLogged();
			setPendingShot(shotId);
			// The next shot starts here: aim it from the ball, not the old spot.
			if (anchors) setTarget(defaultTarget(gps.position, anchors.green, bag));
		} catch {
			toast.error(t.play.markError);
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

	// "On the next tee": offered once per hole until dismissed.
	const [dismissedOffer, setDismissedOffer] = useState<number | null>(null);
	const offerNext =
		!!gps.position &&
		!!anchors &&
		dismissedOffer !== holeIndex &&
		shouldAdvance(
			gps.position,
			anchors,
			nextAnchors ?? undefined,
			gps.accuracyMeters ?? 0,
		);

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

	const numbers = anchors && player ? greenNumbers(player, anchors) : null;
	// The green view is about the green itself; hazard callouts are tee-shot info.
	const hazards: HazardInPlay[] =
		anchors && player && geometry && !greenView
			? hazardsInPlay(player, anchors.green, geometry, { limit: 3 })
			: [];
	const hazardLabel = (h: HazardInPlay) =>
		`${h.kind === "water" ? "W" : "B"} ${distanceNumber(h.reach, units)}/${distanceNumber(h.carry, units)}`;

	const hudTop = insets.top + spacing.sm;
	const hudBottom = insets.bottom + spacing.md;

	return (
		<View style={styles.root}>
			<StatusBar style="light" />
			{anchors && player && target && geometry ? (
				<HoleCanvas
					mode={mode}
					geometry={{ ...geometry, holeLine: geometry.holeLine ?? [] }}
					tee={anchors.tee}
					green={anchors.green}
					player={player}
					located={located}
					accuracyMeters={gps.accuracyMeters}
					target={target}
					onTargetChange={setTarget}
					toTargetLabel={legLabel(
						haversineMeters(player, target),
						units,
						bag,
						true,
					)}
					targetToGreenLabel={
						haversineMeters(target, anchors.green) < 8
							? null
							: legLabel(
									haversineMeters(target, anchors.green),
									units,
									bag,
									false,
								)
					}
					hazards={hazards}
					hazardLabel={hazardLabel}
					greenView={greenView}
					shots={holeShots}
					insets={{
						top: hudTop + 64,
						bottom: hudBottom + 72,
						left: 0,
						// Clear of the front/centre/back stack on the right.
						right: 96,
					}}
				/>
			) : (
				<View style={[styles.noMap, { paddingTop: hudTop + 80 }]}>
					<AppText variant="heading" style={styles.onHud}>
						{t.play.noMap}
					</AppText>
					<AppText variant="footnote" style={styles.onHudMuted}>
						{t.play.noMapHint}
					</AppText>
				</View>
			)}

			{/* Top bar */}
			<View style={[styles.topBar, { top: hudTop }]} pointerEvents="box-none">
				<HudButton
					symbol={{ ios: "xmark", android: "close" }}
					label={t.play.close}
					onPress={() => router.back()}
				/>
				<HudGlass style={styles.switcher}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t.play.previousHole}
						disabled={holeIndex === 0}
						onPress={() => goTo(holeIndex - 1)}
						hitSlop={8}
						style={[styles.chevron, holeIndex === 0 && styles.disabled]}
					>
						<AppText style={styles.chevronGlyph}>‹</AppText>
					</Pressable>
					<View style={styles.switcherText} accessibilityRole="header">
						<AppText variant="heading" style={styles.onHud}>
							{fmt(t.play.hole, {
								n: meta ? holeLabel(meta.ref) : holeIndex + 1,
							})}
						</AppText>
						<AppText variant="caption" style={styles.onHudMuted}>
							{fmt(t.play.holeMeta, {
								par: meta?.par ?? "—",
								si: meta?.strokeIndex ?? "—",
							})}
							{meta?.lengthMeters
								? ` · ${distanceNumber(meta.lengthMeters, units)} ${units}`
								: ""}
						</AppText>
					</View>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t.play.nextHole}
						disabled={holeIndex >= round.holeRefs.length - 1}
						onPress={() => goTo(holeIndex + 1)}
						hitSlop={8}
						style={[
							styles.chevron,
							holeIndex >= round.holeRefs.length - 1 && styles.disabled,
						]}
					>
						<AppText style={styles.chevronGlyph}>›</AppText>
					</Pressable>
				</HudGlass>
				<HudButton
					symbol={{ ios: "list.number", android: "format_list_numbered" }}
					label={t.play.scorecard}
					onPress={() => router.push("/scorecard")}
				/>
			</View>

			{!located && anchors ? (
				<View
					style={[styles.gpsNote, { top: hudTop + 64 }]}
					pointerEvents="none"
				>
					<HudGlass style={styles.gpsPill}>
						<AppText variant="caption" style={styles.onHudMuted}>
							{gps.position ? t.play.offHole : t.play.noGps}
						</AppText>
					</HudGlass>
				</View>
			) : gps.accuracyMeters && gps.accuracyMeters > 15 ? (
				<View
					style={[styles.gpsNote, { top: hudTop + 64 }]}
					pointerEvents="none"
				>
					<HudGlass style={styles.gpsPill}>
						<AppText variant="caption" style={styles.onHudMuted}>
							{fmt(t.play.gpsWeak, { m: Math.round(gps.accuracyMeters) })}
						</AppText>
					</HudGlass>
				</View>
			) : null}

			{/* F / C / B */}
			{numbers ? (
				<View
					style={[styles.stackWrap, { top: hudTop + 104 }]}
					pointerEvents="none"
					accessible
					accessibilityLabel={`${t.play.front} ${distanceNumber(numbers.front, units)}, ${t.play.center} ${distanceNumber(numbers.center, units)}, ${t.play.back} ${distanceNumber(numbers.back, units)} ${units}`}
				>
					<HudGlass capsule={false} style={styles.stack}>
						<Distance
							label={t.play.back}
							value={distanceNumber(numbers.back, units)}
						/>
						<Distance
							label={t.play.center}
							value={distanceNumber(numbers.center, units)}
							big
						/>
						<Distance
							label={t.play.front}
							value={distanceNumber(numbers.front, units)}
						/>
						<AppText variant="micro" style={styles.unit}>
							{units}
						</AppText>
					</HudGlass>
				</View>
			) : null}

			{pendingShot ? (
				<View
					style={[styles.tray, { bottom: hudBottom + 64 }]}
					pointerEvents="box-none"
				>
					<HudGlass capsule={false} style={styles.trayCard}>
						<AppText
							variant="caption"
							style={[styles.onHudMuted, styles.trayTitle]}
						>
							{t.play.whichClub}
						</AppText>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.clubRow}
						>
							{bag.map((club) => (
								<Pressable
									key={club.name}
									accessibilityRole="button"
									onPress={() => pickClub(club.name)}
									style={({ pressed }) => [
										styles.clubChip,
										pressed && styles.pressed,
									]}
								>
									<AppText variant="control" style={styles.onHud}>
										{club.name}
									</AppText>
								</Pressable>
							))}
							<Pressable
								accessibilityRole="button"
								onPress={() => pickClub(undefined)}
								style={({ pressed }) => [
									styles.clubChip,
									styles.skipChip,
									pressed && styles.pressed,
								]}
							>
								<AppText variant="control" style={styles.onHudMuted}>
									{t.play.skipClub}
								</AppText>
							</Pressable>
						</ScrollView>
					</HudGlass>
				</View>
			) : offerNext ? (
				<View
					style={[styles.tray, { bottom: hudBottom + 64 }]}
					pointerEvents="box-none"
				>
					<HudGlass capsule={false} style={styles.offer}>
						<AppText
							variant="control"
							style={[styles.onHud, styles.offerText]}
							accessibilityRole="alert"
						>
							{fmt(t.play.nextTee, {
								n: holeLabel(round.holeRefs[holeIndex + 1] ?? ""),
							})}
						</AppText>
						<Pressable
							accessibilityRole="button"
							onPress={() => setDismissedOffer(holeIndex)}
							hitSlop={6}
							style={({ pressed }) => [
								styles.offerButton,
								pressed && styles.pressed,
							]}
						>
							<AppText variant="control" style={styles.onHudMuted}>
								{t.play.notNow}
							</AppText>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={() => goTo(holeIndex + 1)}
							hitSlop={6}
							style={({ pressed }) => [
								styles.offerButton,
								styles.offerGo,
								pressed && styles.pressed,
							]}
						>
							<AppText variant="control" style={styles.offerGoText}>
								{fmt(t.play.goToHole, {
									n: holeLabel(round.holeRefs[holeIndex + 1] ?? ""),
								})}
							</AppText>
						</Pressable>
					</HudGlass>
				</View>
			) : null}

			{/* Bottom bar */}
			<View
				style={[styles.bottomBar, { bottom: hudBottom }]}
				pointerEvents="box-none"
			>
				<HudButton
					symbol={
						greenView
							? { ios: "map", android: "map" }
							: { ios: "flag.fill", android: "flag" }
					}
					label={greenView ? t.play.holeView : t.play.greenView}
					active={greenView}
					onPress={() => setGreenView((v) => !v)}
					disabled={!anchors}
				/>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={fmt(t.play.scoreHole, {
						n: meta ? holeLabel(meta.ref) : holeIndex + 1,
					})}
					onPress={() =>
						router.push({
							pathname: "/score",
							params: { hole: String(holeIndex) },
						})
					}
					style={({ pressed }) => [
						styles.scoreButton,
						pressed && { opacity: 0.85 },
					]}
				>
					<AppText variant="control" style={styles.scoreLabel}>
						{fmt(t.play.scoreHole, {
							n: meta ? holeLabel(meta.ref) : holeIndex + 1,
						})}
					</AppText>
				</Pressable>
				<HudButton
					symbol={{ ios: "mappin.and.ellipse", android: "add_location" }}
					label={t.play.markShot}
					onPress={() => void onMarkShot()}
					disabled={!anchors || marking}
				/>
			</View>
		</View>
	);
}

function Distance({
	label,
	value,
	big,
}: {
	label: string;
	value: string;
	big?: boolean;
}) {
	return (
		<View style={styles.number}>
			<AppText variant="micro" style={styles.onHudMuted}>
				{label.toUpperCase()}
			</AppText>
			<AppText
				variant={big ? "metric" : "heading"}
				style={[styles.numberValue, big && styles.numberBig]}
			>
				{value}
			</AppText>
		</View>
	);
}

const SHADOW = {
	textShadowColor: course.distanceShadow,
	textShadowOffset: { width: 0, height: 1 },
	textShadowRadius: 4,
};

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
	noMap: {
		flex: 1,
		alignItems: "center",
		gap: spacing.xs,
		padding: spacing.lg,
	},
	onHud: { color: course.hudText, ...SHADOW },
	onHudMuted: { color: course.hudTextMuted },
	topBar: {
		position: "absolute",
		left: spacing.md,
		right: spacing.md,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	switcher: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: spacing.xs,
		minHeight: 52,
	},
	switcherText: { flex: 1, alignItems: "center" },
	chevron: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
	chevronGlyph: { ...typeRamp.title, color: course.hudText },
	disabled: { opacity: 0.3 },
	gpsNote: { position: "absolute", left: 0, right: 0, alignItems: "center" },
	gpsPill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
	stackWrap: { position: "absolute", right: spacing.md },
	stack: {
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		alignItems: "center",
		gap: spacing.xs,
	},
	number: { alignItems: "center" },
	numberValue: {
		color: course.hudText,
		fontVariant: ["tabular-nums"],
		...SHADOW,
	},
	numberBig: { color: course.distanceText },
	unit: { color: course.hudTextMuted },
	bottomBar: {
		position: "absolute",
		left: spacing.md,
		right: spacing.md,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	scoreButton: {
		flex: 1,
		minHeight: 52,
		borderRadius: 26,
		backgroundColor: course.target,
		alignItems: "center",
		justifyContent: "center",
	},
	scoreLabel: { color: course.onTarget, fontWeight: "800" },
	pressed: { opacity: 0.7 },
	tray: { position: "absolute", left: spacing.md, right: spacing.md },
	trayCard: { paddingVertical: spacing.sm, gap: spacing.xs },
	trayTitle: { paddingHorizontal: spacing.md },
	clubRow: { gap: spacing.xs, paddingHorizontal: spacing.md },
	clubChip: {
		minHeight: 44,
		minWidth: 52,
		paddingHorizontal: spacing.md,
		borderRadius: 22,
		borderWidth: 1,
		borderColor: course.ring,
		alignItems: "center",
		justifyContent: "center",
	},
	skipChip: { borderStyle: "dashed" },
	offer: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		padding: spacing.xs,
		paddingLeft: spacing.md,
	},
	offerText: { flex: 1 },
	offerButton: {
		minHeight: 44,
		paddingHorizontal: spacing.md,
		borderRadius: 22,
		alignItems: "center",
		justifyContent: "center",
	},
	offerGo: { backgroundColor: course.target },
	offerGoText: { color: course.onTarget, fontWeight: "800" },
});
