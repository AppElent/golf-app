import { holeLabel } from "@fairway/core/format";
import { OWNER_INDEX } from "@fairway/core/round";
import { useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useSubmit } from "../../../convex/use-submit";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { spacing, type Tokens, useThemedStyles } from "../../../theme";
import { FormScreen } from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { NoActiveRound } from "../components/no-active-round";
import { type ActiveRound, useActiveRound } from "../use-active-round";
import { PlayerScoreForm } from "./player-score-form";
import { initialDrafts, type ScoreDraft } from "./score-model";
import { ScoreSheetHeader } from "./score-sheet-header";

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
	const { t } = useI18n();
	const router = useRouter();
	const styles = useThemedStyles(createStyles);
	const setScore = useMutation(api.rounds.setScore);
	const setCurrentHole = useMutation(api.rounds.setCurrentHole);
	const { round, holes, scores } = active;
	const hole = holes[holeIndex];
	const [drafts, setDrafts] = useState<ScoreDraft[]>(() =>
		initialDrafts(scores, holeIndex, round.players.length, hole.par),
	);
	const submit = useSubmit();
	const saving = submit.pending;
	const isLast = holeIndex === holes.length - 1;
	// "Next hole" only on the first entry for the hole being played; a
	// correction (also after browsing back with the chevrons) stays put.
	const firstEntry = !scores.some((x) => x.holeIndex === holeIndex);
	const advances =
		!isLast && firstEntry && holeIndex === round.currentHoleIndex;

	const update = (playerIndex: number, patch: Partial<ScoreDraft>) =>
		setDrafts((all) =>
			all.map((d, i) => (i === playerIndex ? { ...d, ...patch } : d)),
		);

	const onSave = () =>
		submit.run(
			async (isOpen) => {
				await Promise.all(
					drafts.map((draft, playerIndex) =>
						setScore({
							roundId: round._id,
							holeIndex,
							playerIndex,
							...draft,
						}),
					),
				);
				if (advances && isOpen()) {
					await setCurrentHole({
						roundId: round._id,
						holeIndex: holeIndex + 1,
					});
				}
			},
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

	const title = fmt(t.score.title, {
		n: holeLabel(hole.ref),
		par: hole.par,
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
					<Stack.Screen options={{ gestureEnabled: !saving }} />
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
						// The sheet opens at a partial detent, so a footer button would
						// sit below the fold.
						<ScoreSheetHeader
							title={title}
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
				{round.players.map((player, playerIndex) => (
					<PlayerScoreForm
						// biome-ignore lint/suspicious/noArrayIndexKey: players are fixed at round start; the index is their identity
						key={playerIndex}
						name={player.name}
						par={hole.par}
						draft={drafts[playerIndex]}
						owner={playerIndex === OWNER_INDEX}
						onChange={(patch) => update(playerIndex, patch)}
					/>
				))}
			</FormScreen>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		error: { color: colors.danger },
	});
