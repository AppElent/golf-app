import { formatDistance, holeLabel } from "@fairway/core/format";
import { OWNER_INDEX, scoreAt } from "@fairway/core/round";
import { strokesPerHole } from "@fairway/core/scoring";
import { useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useSubmit } from "../../../convex/use-submit";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { FormScreen } from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { useUnits } from "../../profile/use-units";
import { NoActiveRound } from "../components/no-active-round";
import { type ActiveRound, useActiveRound } from "../use-active-round";
import { FlightRow } from "./flight-row";
import { OwnerScoreCard } from "./owner-score-card";
import {
	draftUpdate,
	flightDetail,
	initialDrafts,
	type ScoreDraft,
	type ScoreDraftPatch,
} from "./score-model";
import { HoleTitle, ScoreSheetHeader } from "./score-sheet-header";

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
	const [drafts, setDrafts] = useState<ScoreDraft[]>(() =>
		initialDrafts(scores, holeIndex, round.players.length, hole.par),
	);
	const submit = useSubmit();
	const saving = submit.pending;
	const isLast = holeIndex === holes.length - 1;
	// "Next hole" only on the first entry of your own score for the hole being
	// played; a correction (also after browsing back with the chevrons) stays
	// put. Guests scored first don't count, like the next-tee offer.
	const firstEntry = !scoreAt(scores, holeIndex, OWNER_INDEX);
	const advances =
		!isLast && firstEntry && holeIndex === round.currentHoleIndex;

	const update = (playerIndex: number, patch: ScoreDraftPatch) =>
		setDrafts((all) =>
			all.map((d, i) => (i === playerIndex ? { ...d, ...patch } : d)),
		);

	// One mutation for every player and the move to the next hole: one round
	// trip, and the round never advances without its scores.
	const onSave = () =>
		submit.run(
			() =>
				saveHole({
					roundId: round._id,
					holeIndex,
					// A player without a score yet is left out, not stored at par.
					scores: drafts.flatMap((draft, playerIndex) => {
						const update = draftUpdate(draft, {
							par: hole.par,
							owner: playerIndex === OWNER_INDEX,
							stored: scoreAt(scores, holeIndex, playerIndex) !== undefined,
						});
						return update ? [{ playerIndex, ...update }] : [];
					}),
					...(advances ? { advanceTo: holeIndex + 1 } : {}),
				}),
			{
				errorFallback: t.score.saveError,
				onSuccess: () => {
					haptics.saveConfirmed();
					if (isLast && firstEntry) {
						router.replace("/scorecard");
					} else {
						router.back();
					}
				},
			},
		);

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
	const received = useMemo(
		() =>
			round.players.map(
				(p) => strokesPerHole(holes, p.playingHandicap ?? 0)[holeIndex],
			),
		[round.players, holes, holeIndex],
	);
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
							disabled={saving}
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
				{submit.error ? (
					<AppText selectable accessibilityRole="alert" style={styles.error}>
						{submit.error}
					</AppText>
				) : null}
				<View style={styles.players}>
					<OwnerScoreCard
						name={round.players[OWNER_INDEX].name}
						par={hole.par}
						draft={drafts[OWNER_INDEX]}
						received={received[OWNER_INDEX]}
						stableford={stableford}
						onChange={(patch) => update(OWNER_INDEX, patch)}
					/>
					{round.players.length > 1 ? (
						<>
							<AppText variant="caption" style={styles.flightLabel}>
								{t.score.flight.toUpperCase()}
							</AppText>
							<View style={styles.flight}>
								{round.players.map((player, playerIndex) =>
									playerIndex === OWNER_INDEX ? null : (
										<View
											// biome-ignore lint/suspicious/noArrayIndexKey: players are fixed at round start; the index is their identity
											key={playerIndex}
											style={playerIndex > 1 && styles.flightDivider}
										>
											<FlightRow
												name={player.name}
												par={hole.par}
												draft={drafts[playerIndex]}
												detail={flightDetail({
													draft: drafts[playerIndex],
													par: hole.par,
													received: received[playerIndex],
													stableford,
													copy: t.score,
													strokesLabel: strokesLabel(received[playerIndex]),
												})}
												onChange={(patch) => update(playerIndex, patch)}
											/>
										</View>
									),
								)}
							</View>
						</>
					) : null}
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
