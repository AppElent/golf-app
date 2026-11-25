import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useSubmit } from "../../../convex/use-submit";
import { fmt, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { GhostButton } from "../../../ui/button";
import { useConfirm } from "../../../ui/confirm-dialog";
import { FormScreen } from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { useEndSimulation } from "../../simulation/mode/use-end-simulation";
import { NoActiveRound } from "../components/no-active-round";
import { ScorecardGrid } from "../components/scorecard-grid";
import { cardRows } from "../components/scorecard-model";
import { StandingBox } from "../formats/game-boxes";
import { GameTotals } from "../formats/game-totals";
import { useGame } from "../formats/use-game";
import { useActiveRound } from "../use-active-round";
import { useFinishRound } from "./use-finish-round";

export function ScorecardScreen() {
	const { t } = useI18n();
	const router = useRouter();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const confirm = useConfirm();
	const active = useActiveRound();
	const endSimulation = useEndSimulation();
	const finish = useFinishRound();
	const game = useGame();
	const abandon = useMutation(api.rounds.abandon);
	const submit = useSubmit();

	const header = (
		<NavHeader
			title={t.scorecard.title}
			left={{ label: t.common.done, onPress: () => router.back() }}
			right={
				active
					? {
							label: t.handicapTable.title,
							onPress: () => router.push("/handicap-table"),
						}
					: undefined
			}
		/>
	);
	if (active === undefined) {
		return (
			<View style={{ flex: 1, padding: spacing.lg }}>
				{header}
				<SkeletonList rows={4} leading={false} />
			</View>
		);
	}
	if (active === null) {
		return (
			<>
				{header}
				<NoActiveRound title={t.play.noRound} closeLabel={t.common.done} />
			</>
		);
	}

	const { round, holes, scores, course } = active;
	const { sides, received, ...text } = game(round, holes, scores);
	const rows = cardRows(holes, scores, received);
	const standing = text.cardStanding();
	const tiles = rows.map(
		(row, side) =>
			text.comparedTotal(side) ?? {
				strokes: row.scored > 0 ? String(row.total) : "–",
				toPar: row.toPar,
			},
	);
	const totals = text.totals();
	const pending = finish.pending || submit.pending;
	const error = finish.error ?? submit.error;
	const roundId = round._id;

	async function onAbandon() {
		const ok = await confirm({
			title: t.scorecard.abandonTitle,
			message: t.scorecard.abandonMessage,
			confirmLabel: t.scorecard.abandon,
			destructive: true,
		});
		if (!ok) return;
		await submit.run(() => abandon({ roundId }), {
			errorFallback: t.scorecard.abandonError,
			onSuccess: () => {
				if (round.simulated) endSimulation();
				router.dismissAll();
			},
		});
	}

	return (
		<>
			{header}
			<FormScreen
				avoidKeyboard={false}
				primaryAction={{
					label: t.scorecard.finish,
					onPress: () => void finish.finishRound(active, scores),
					loading: finish.pending,
					disabled: pending,
				}}
			>
				<View style={styles.heading}>
					<AppText variant="heading">{course.name}</AppText>
					{round.loopLabel ? (
						<AppText variant="secondary">{round.loopLabel}</AppText>
					) : null}
				</View>
				<View style={styles.totals}>
					{sides.map((side, p) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: sides are fixed at round start
						<View key={p} style={styles.total}>
							<AppText variant="label" numberOfLines={1}>
								{side.name}
							</AppText>
							<AppText variant="title" style={styles.totalNumber}>
								{tiles[p].strokes}
							</AppText>
							<AppText variant="footnote">
								{[
									tiles[p].toPar,
									round.format === "stableford"
										? fmt(t.scorecard.points, { n: rows[p].points })
										: null,
								]
									.filter(Boolean)
									.join(" · ")}
							</AppText>
						</View>
					))}
				</View>
				{standing ? <StandingBox {...standing} /> : null}
				<ScorecardGrid
					holes={holes}
					players={sides}
					rows={rows}
					received={standing ? received : undefined}
					gameRows={text.cardRows()}
					currentHole={round.currentHoleIndex}
					onHolePress={(hole) =>
						router.push({
							pathname: "/score",
							params: { hole: String(hole) },
						})
					}
				/>
				{totals ? <GameTotals {...totals} /> : null}
				{error ? (
					<AppText
						selectable
						accessibilityRole="alert"
						style={{ color: colors.danger }}
					>
						{error}
					</AppText>
				) : null}
				<GhostButton
					label={t.scorecard.abandon}
					onPress={onAbandon}
					loading={submit.pending}
					disabled={pending}
					tone="danger"
				/>
			</FormScreen>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		heading: { gap: spacing.xs },
		totals: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
		total: {
			flexGrow: 1,
			flexBasis: 140,
			padding: spacing.md,
			gap: spacing.xs,
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
		},
		totalNumber: { fontVariant: ["tabular-nums"] },
	});
