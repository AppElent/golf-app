/**
 * The score sheet: one hole, every player. Strokes for each player (quick
 * picks around par plus a stepper), and for the owner the stats the round
 * history and stats screens use — putts, fairway, green in regulation,
 * penalties, or a pick-up.
 *
 * Online first: the sheet closes only once the server has every score. A
 * failed save keeps the sheet and its edits open and says so.
 */
import { holeLabel } from "@fairway/core/format";
import { useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, View } from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import {
	course,
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { convexErrorMessage } from "../../../ui/confirm-dialog";
import { EmptyState } from "../../../ui/empty-state";
import {
	FormScreen,
	FormSegmentedRow,
	GroupedSurface,
	StepperField,
} from "../../../ui/form";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import {
	draftToScore,
	initialDrafts,
	quickStrokes,
	type ScoreDraft,
	tracksFairway,
} from "./score-model";

type Active = NonNullable<
	ReturnType<typeof useQuery<typeof api.rounds.active>>
>;

export function ScoreSheetScreen() {
	const { t } = useI18n();
	const router = useRouter();
	const params = useLocalSearchParams<{ hole?: string }>();
	const active = useQuery(api.rounds.active, {});

	if (active === undefined) {
		return (
			<View style={{ flex: 1, padding: spacing.lg }}>
				<SkeletonList rows={4} />
			</View>
		);
	}
	if (active === null) {
		return (
			<EmptyState
				title={t.score.noRound}
				body={t.play.noRoundHint}
				action={{ label: t.common.done, onPress: () => router.back() }}
			/>
		);
	}
	const parsed = Number(params.hole);
	const holeIndex =
		Number.isInteger(parsed) && parsed >= 0 && parsed < active.holes.length
			? parsed
			: (active.round.currentHoleIndex ?? 0);
	// Keyed by hole so a sheet reused for another hole starts fresh.
	return <ScoreSheet key={holeIndex} active={active} holeIndex={holeIndex} />;
}

function ScoreSheet({
	active,
	holeIndex,
}: {
	active: Active;
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
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const isLast = holeIndex === holes.length - 1;
	// "Next hole" only when scoring the hole being played, not a correction.
	const advances = !isLast && holeIndex === (round.currentHoleIndex ?? 0);

	const update = (playerIndex: number, patch: Partial<ScoreDraft>) =>
		setDrafts((all) =>
			all.map((d, i) => (i === playerIndex ? { ...d, ...patch } : d)),
		);

	async function onSave() {
		setSaving(true);
		setError(null);
		try {
			await Promise.all(
				drafts.map((draft, playerIndex) =>
					setScore({
						roundId: round._id,
						holeIndex,
						playerIndex,
						...draftToScore(draft),
					}),
				),
			);
			if (advances) {
				await setCurrentHole({ roundId: round._id, holeIndex: holeIndex + 1 });
			}
			haptics.entryLogged();
			if (isLast && holeIndex === (round.currentHoleIndex ?? 0)) {
				router.replace("/scorecard");
			} else {
				router.back();
			}
		} catch (e) {
			setError(convexErrorMessage(e, t.score.saveError));
			setSaving(false);
		}
	}

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
					<Stack.Screen options={{ title, gestureEnabled: !saving }} />
					<Stack.Toolbar placement="left">
						<Stack.Toolbar.Button onPress={() => router.back()}>
							{t.common.cancel}
						</Stack.Toolbar.Button>
					</Stack.Toolbar>
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
				title={ios ? undefined : title}
				onCancel={() => router.back()}
				cancelLabel={t.common.cancel}
				nativeSheet={ios}
				// In the header: the sheet opens at a partial detent, so a footer
				// button would sit below the fold.
				primaryActionPlacement="header"
				primaryAction={
					ios
						? undefined
						: { label: saveLabel, onPress: onSave, loading: saving }
				}
			>
				{error ? (
					<AppText selectable accessibilityRole="alert" style={styles.error}>
						{error}
					</AppText>
				) : null}
				{round.players.map((player, playerIndex) => (
					<PlayerScore
						// biome-ignore lint/suspicious/noArrayIndexKey: players are fixed at round start; the index is their identity
						key={playerIndex}
						name={player.name}
						par={hole.par}
						draft={drafts[playerIndex]}
						owner={playerIndex === 0}
						onChange={(patch) => update(playerIndex, patch)}
					/>
				))}
			</FormScreen>
		</>
	);
}

function PlayerScore({
	name,
	par,
	draft,
	owner,
	onChange,
}: {
	name: string;
	par: number;
	draft: ScoreDraft;
	owner: boolean;
	onChange: (patch: Partial<ScoreDraft>) => void;
}) {
	const { t } = useI18n();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const yesNo = (value: boolean | null) =>
		value === null ? "unset" : value ? "hit" : "missed";
	const fromYesNo = (value: "unset" | "hit" | "missed") =>
		value === "unset" ? null : value === "hit";
	const yesNoOptions = [
		{ value: "unset" as const, label: "—" },
		{ value: "hit" as const, label: t.score.hit },
		{ value: "missed" as const, label: t.score.missed },
	];

	return (
		<View style={styles.player}>
			<AppText variant="label">{name}</AppText>
			<GroupedSurface style={styles.strokesSurface}>
				<View
					style={styles.quickRow}
					accessibilityRole="radiogroup"
					accessibilityLabel={fmt(t.score.strokesFor, { name })}
				>
					{quickStrokes(par).map((n) => {
						const selected = !draft.nr && draft.strokes === n;
						return (
							<Pressable
								key={n}
								onPress={() => {
									haptics.selectionChanged();
									onChange({ strokes: n, nr: false });
								}}
								accessibilityRole="radio"
								accessibilityState={{ checked: selected }}
								style={({ pressed }) => [
									styles.quick,
									n < par && styles.quickUnder,
									selected && styles.quickSelected,
									pressed && { opacity: 0.7 },
								]}
							>
								<AppText
									variant="title"
									style={[
										styles.quickText,
										selected && { color: colors.onAccent },
									]}
								>
									{n}
								</AppText>
							</Pressable>
						);
					})}
				</View>
				<StepperField
					label={t.score.strokes}
					value={draft.strokes}
					min={1}
					onChange={(strokes) => onChange({ strokes, nr: false })}
				/>
			</GroupedSurface>
			{owner ? (
				<>
					<View style={styles.statRow}>
						<View style={styles.statHalf}>
							<StepperField
								label={t.score.putts}
								value={draft.putts}
								startAt={2}
								onChange={(putts) => onChange({ putts })}
							/>
						</View>
						<View style={styles.statHalf}>
							<StepperField
								label={t.score.penalties}
								value={draft.penalties}
								onChange={(penalties) => onChange({ penalties })}
							/>
						</View>
					</View>
					{tracksFairway(par) ? (
						<View style={styles.rowSurface}>
							<FormSegmentedRow
								label={t.score.fairway}
								options={yesNoOptions}
								value={yesNo(draft.fir)}
								onChange={(v) => onChange({ fir: fromYesNo(v) })}
							/>
						</View>
					) : null}
					<View style={styles.rowSurface}>
						<FormSegmentedRow
							label={t.score.green}
							options={yesNoOptions}
							value={yesNo(draft.gir)}
							onChange={(v) => onChange({ gir: fromYesNo(v) })}
						/>
					</View>
				</>
			) : null}
			<View style={styles.switchRow}>
				<View style={{ flex: 1 }}>
					<AppText>{t.score.pickedUp}</AppText>
					<AppText variant="footnote">{t.score.pickedUpHint}</AppText>
				</View>
				<Switch
					value={draft.nr}
					onValueChange={(nr) => onChange({ nr })}
					accessibilityLabel={t.score.pickedUp}
					trackColor={{ true: colors.accentFill }}
				/>
			</View>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		error: { color: colors.danger },
		player: { gap: spacing.sm },
		strokesSurface: { gap: spacing.md },
		quickRow: { flexDirection: "row", justifyContent: "space-evenly" },
		quick: {
			width: 60,
			height: 60,
			borderRadius: radius.pill,
			borderWidth: 1.5,
			borderColor: colors.borderStrong,
			alignItems: "center",
			justifyContent: "center",
		},
		// Under par wears the scorecard's birdie red, as a ring.
		quickUnder: { borderColor: course.birdie },
		quickSelected: {
			backgroundColor: colors.accentFill,
			borderColor: colors.accentFill,
		},
		quickText: { fontVariant: ["tabular-nums"] },
		rowSurface: { backgroundColor: colors.surface, borderRadius: radius.lg },
		statRow: { flexDirection: "row", gap: spacing.sm },
		statHalf: { flex: 1 },
		switchRow: {
			minHeight: metrics.rowMinHeight,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.sm,
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
		},
	});
