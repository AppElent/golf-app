import { formatDistance, holeLabel } from "@fairway/core/format";
import { OWNER_INDEX, playedHoles, scoreAt } from "@fairway/core/round";
import { useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useSubmit } from "../../../convex/use-submit";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { showAlert } from "../../../monitoring/native-presentation";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { FormScreen } from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { useUnits } from "../../profile/use-units";
import { NoActiveRound } from "../components/no-active-round";
import { HoleResultBox, StandingBox } from "../formats/game-boxes";
import { newlyDecided, withHole } from "../formats/game-text";
import { useGame } from "../formats/use-game";
import { type ActiveRound, useActiveRound } from "../use-active-round";
import { FlightRow } from "./flight-row";
import { OwnerScoreCard } from "./owner-score-card";
import {
	flightDetail,
	initialDrafts,
	type ScoreDraftPatch,
	type SheetEdits,
	sheetDrafts,
	sheetUpdates,
} from "./score-model";
import { HoleTitle, ScoreSheetHeader } from "./score-sheet-header";
import { useFinishRound } from "./use-finish-round";

export function ScoreSheetScreen() {
	const { t } = useI18n();
	const params = useLocalSearchParams<{ hole?: string }>();
	const active = useActiveRound();

	if (active === undefined) {
		return (
			<View style={{ flex: 1, padding: spacing.lg }}>
				<SkeletonList rows={4} />
			</View>
		);
	}
	if (active === null) {
		return <NoActiveRound title={t.score.noRound} closeLabel={t.common.done} />;
	}
	const parsed = Number(params.hole);
	const holeIndex =
		Number.isInteger(parsed) && parsed >= 0 && parsed < active.holes.length
			? parsed
			: active.round.currentHoleIndex;
	// Keyed by hole so a sheet reused for another hole starts fresh.
	return <ScoreSheet key={holeIndex} active={active} holeIndex={holeIndex} />;
}

function ScoreSheet({
	active,
	holeIndex,
}: {
	active: ActiveRound;
	holeIndex: number;
}) {
	const { t, locale } = useI18n();
	const units = useUnits();
	const router = useRouter();
	const styles = useThemedStyles(createStyles);
	const saveHole = useMutation(api.rounds.saveHole);
	const { round, holes, scores } = active;
	const hole = holes[holeIndex];
	const game = useGame();
	const saved = game(round, holes, scores);
	// A scramble is scored per team: no owner card, stats or starting par.
	const teams = round.format === "scramble";
	const live = initialDrafts(
		scores,
		holeIndex,
		saved.sides.length,
		teams ? undefined : hole.par,
	);
	// The owner's card is always saved; another side once it is changed here.
	const [edits, setEdits] = useState<SheetEdits>(() => {
		const own: SheetEdits = { [OWNER_INDEX]: live[OWNER_INDEX] };
		return teams ? {} : own;
	});
	const drafts = sheetDrafts(live, edits);
	const entered = withHole(scores, holeIndex, drafts);
	const preview = game(round, holes, entered);
	const finish = useFinishRound();
	const submit = useSubmit();
	// Saved, but finishing failed: Save only closes the sheet then.
	const saving = submit.pending && !finish.error;
	const isLast = holeIndex === holes.length - 1;
	// "Next hole" only on the first entry of your own score for the hole being
	// played; a correction (also after browsing back with the chevrons) stays
	// put. Guests scored first don't count, like the next-tee offer.
	const firstEntry = !scoreAt(scores, holeIndex, OWNER_INDEX);
	const entersOwn =
		drafts[OWNER_INDEX].nr || drafts[OWNER_INDEX].strokes !== null;
	const advances =
		!isLast && firstEntry && entersOwn && holeIndex === round.currentHoleIndex;

	// A scramble sheet opens empty; there is nothing to save yet.
	const empty =
		teams &&
		drafts.every(
			(draft, side) =>
				!draft.nr &&
				draft.strokes === null &&
				!scoreAt(scores, holeIndex, side),
		);

	const update = (playerIndex: number, patch: ScoreDraftPatch) =>
		setEdits((all) => ({
			...all,
			[playerIndex]: { ...(all[playerIndex] ?? live[playerIndex]), ...patch },
		}));

	// Playing out a decided match is the players' choice.
	const askToPlayOut = (winner: string, left: number) =>
		showAlert(winner, plural(locale, left, t.formats.decidedMessage), [
			{
				text: t.formats.finish,
				onPress: async () => {
					if (!(await finish.finishRound(active, entered))) router.back();
				},
			},
			{
				text: t.formats.keepPlaying,
				isPreferred: true,
				onPress: () => router.back(),
			},
		]);

	// One mutation for every player and the move to the next hole: one round
	// trip, and the round never advances without its scores.
	const onSave = async () => {
		if (empty) return;
		if (finish.error) return router.back();
		await submit.run(
			() =>
				saveHole({
					roundId: round._id,
					holeIndex,
					scores: sheetUpdates(edits, scores, {
						holeIndex,
						par: hole.par,
						teams,
					}),
					...(advances ? { advanceTo: holeIndex + 1 } : {}),
				}),
			{
				errorFallback: t.score.saveError,
				onSuccess: () => {
					haptics.saveConfirmed();
					const decided = newlyDecided(saved.standing, preview.standing);
					const left = holes.length - playedHoles(holes.length, entered).length;
					const standing = preview.cardStanding();
					if (decided && standing && left > 0) {
						askToPlayOut(standing.title, left);
					} else if (isLast && firstEntry) {
						router.replace("/scorecard");
					} else {
						router.back();
					}
				},
			},
		);
	};

	const title = fmt(t.score.title, { n: holeLabel(hole.ref) });
	const subtitle = [
		fmt(t.play.holeMeta, { par: hole.par, si: hole.strokeIndex }),
		hole.lengthMeters ? formatDistance(hole.lengthMeters, units) : null,
	]
		.filter(Boolean)
		.join(" · ");
	// Memoized: a new options object every render re-renders the header.
	const sheetOptions = useMemo(
		() => ({
			gestureEnabled: !saving,
			headerTitle: () => <HoleTitle title={title} subtitle={subtitle} />,
		}),
		[saving, title, subtitle],
	);
	const stableford = round.format === "stableford";
	const received = saved.received.map((strokes) => strokes[holeIndex]);
	const gamePoints = (side: number) => {
		const { standing } = preview;
		return standing?.kind === "sixes"
			? (standing.holes[holeIndex]?.points[side] ?? null)
			: null;
	};
	const rows = saved.sides.flatMap((side, index) =>
		!teams && index === OWNER_INDEX ? [] : [{ side, index }],
	);
	const standing = saved.sheetStanding(holeIndex);
	const result = preview.holeResult(holeIndex);
	const error = submit.error ?? finish.error;
	const strokesLabel = (n: number) =>
		fmt(plural(locale, Math.abs(n), t.score.strokesReceived), {
			sign: n < 0 ? "−" : "+",
		});
	const saveLabel = saving ? t.score.saving : t.score.save;
	const ios = Platform.OS === "ios";

	return (
		<>
			{ios ? (
				// iOS: the sheet's own native header (an in-content header sits
				// under the sheet's root scroll view).
				<>
					<NavHeader
						title={title}
						left={{ label: t.common.cancel, onPress: () => router.back() }}
					/>
					<Stack.Screen options={sheetOptions} />
					<Stack.Toolbar placement="right">
						<Stack.Toolbar.Button
							onPress={() => void onSave()}
							disabled={saving || empty}
							variant="prominent"
						>
							{saveLabel}
						</Stack.Toolbar.Button>
					</Stack.Toolbar>
				</>
			) : null}
			<FormScreen
				nativeSheet={ios}
				header={
					ios ? undefined : (
						// Save stays in view: the sheet can scroll past a footer button.
						<ScoreSheetHeader
							title={title}
							subtitle={subtitle}
							cancelLabel={t.common.cancel}
							onCancel={() => router.back()}
							saveLabel={saveLabel}
							onSave={onSave}
							saving={saving}
						/>
					)
				}
			>
				{error ? (
					<AppText selectable accessibilityRole="alert" style={styles.error}>
						{error}
					</AppText>
				) : null}
				<View style={styles.players}>
					{standing ? <StandingBox {...standing} /> : null}
					{teams ? null : (
						<OwnerScoreCard
							name={round.players[OWNER_INDEX].name}
							par={hole.par}
							draft={drafts[OWNER_INDEX]}
							received={received[OWNER_INDEX]}
							stableford={stableford}
							game={
								saved.standing ? { points: gamePoints(OWNER_INDEX) } : undefined
							}
							onChange={(patch) => update(OWNER_INDEX, patch)}
						/>
					)}
					{rows.length > 0 ? (
						<>
							<AppText variant="caption" style={styles.flightLabel}>
								{(teams ? t.setup.teams : t.score.flight).toUpperCase()}
							</AppText>
							<View style={styles.flight}>
								{rows.map(({ side, index }, row) => (
									<View key={index} style={row > 0 && styles.flightDivider}>
										<FlightRow
											name={side.name}
											initial={
												teams && rows.length > 1 ? String(index + 1) : undefined
											}
											par={hole.par}
											draft={drafts[index]}
											members={side.members ?? undefined}
											detail={flightDetail({
												draft: drafts[index],
												par: hole.par,
												received: received[index],
												stableford,
												gamePoints: gamePoints(index),
												copy: t.score,
												strokesLabel: strokesLabel(received[index]),
											})}
											onChange={(patch) => update(index, patch)}
										/>
									</View>
								))}
							</View>
						</>
					) : null}
					{result ? <HoleResultBox {...result} /> : null}
				</View>
			</FormScreen>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		error: { color: colors.danger },
		// One child of the form, so its rows sit tighter than form sections.
		players: { gap: 10 },
		flightLabel: {
			paddingHorizontal: spacing.xs,
			fontWeight: "700",
			letterSpacing: 0.2,
		},
		flight: {
			backgroundColor: colors.surface,
			borderRadius: radius.sheet,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		flightDivider: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
	});
