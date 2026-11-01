/**
 * One round after the fact, and the recap the scorecard lands on when a round
 * is finished: where and when, the headline numbers (score, to par, net,
 * points, differential, putts, fairways, greens), how it went (birdies, pars
 * and so on, the best and the toughest hole, the nines) and the full
 * scorecard. Share sends a text summary through the system share sheet;
 * deleting the round is the other action, confirmed.
 */
import { holeLabel } from "@fairway/core/format";
import { roundRecap } from "@fairway/core/recap";
import { formatVsPar } from "@fairway/core/scoring";
import { useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { dateLocale, fmt, localizeDecimal, useI18n } from "../../../i18n";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../../theme";
import { GhostButton } from "../../../ui/button";
import { convexErrorMessage, useConfirm } from "../../../ui/confirm-dialog";
import { EmptyState } from "../../../ui/empty-state";
import { ScreenHeader } from "../../../ui/screen-header";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { cardRows } from "../scoring/score-model";
import { ScorecardGrid } from "../scoring/scorecard-grid";
import { ownerRoundStats } from "./history-model";

export function RoundDetailScreen() {
	const { t, locale } = useI18n();
	const router = useRouter();
	const confirm = useConfirm();
	const styles = useThemedStyles(createStyles);
	const { roundId } = useLocalSearchParams<{ roundId: string }>();
	const detail = useQuery(api.rounds.detail, {
		roundId: roundId as Id<"rounds">,
	});
	const remove = useMutation(api.rounds.remove);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const header = <Stack.Screen options={{ title: t.rounds.detailTitle }} />;

	if (detail === undefined) {
		return (
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={styles.content}
			>
				{header}
				<SkeletonList rows={4} />
			</ScrollView>
		);
	}
	if (detail === null) {
		return (
			<>
				{header}
				<EmptyState
					title={t.rounds.notFound}
					body={t.rounds.emptyHint}
					action={{ label: t.common.back, onPress: () => router.back() }}
				/>
			</>
		);
	}

	const { round, course, tee, holes, scores } = detail;
	const rows = cardRows(holes, scores, round.players);
	const owner = rows[0];
	const extra = ownerRoundStats(holes, scores);
	const decimal = (n: number) => localizeDecimal(n.toFixed(1), locale);
	const recap = roundRecap(
		holes,
		owner.cells.map((c) => c.strokes),
		round.players[0]?.playingHandicap,
	);
	const vsPar = (n: number) => localizeDecimal(formatVsPar(n), locale);
	const resultName = (toPar: number) =>
		toPar <= -2
			? t.rounds.eagle
			: toPar === -1
				? t.rounds.birdie
				: toPar === 0
					? t.rounds.par
					: vsPar(toPar);
	const holeResult = (h: { holeIndex: number; toPar: number }) =>
		fmt(t.rounds.holeResult, {
			result: resultName(h.toPar),
			hole: holeLabel(holes[h.holeIndex]?.ref ?? String(h.holeIndex + 1)),
		});
	const nineLabels =
		recap.nines.length > 1
			? [t.scorecard.out, t.scorecard.in]
			: [t.scorecard.total];

	const tiles = [
		{
			label: t.rounds.score,
			value: owner.scored > 0 ? String(owner.total) : "–",
		},
		{ label: t.rounds.toPar, value: owner.toPar ?? "–" },
		recap.net !== null && recap.netToPar !== null
			? {
					label: t.rounds.net,
					value: String(recap.net),
					sub: vsPar(recap.netToPar),
				}
			: null,
		round.format === "stableford"
			? { label: t.rounds.points, value: String(owner.points) }
			: null,
		round.scoreDifferential != null
			? {
					label:
						round.holeRefs.length === 9
							? t.rounds.differentialNine
							: t.rounds.differential,
					value: decimal(round.scoreDifferential),
				}
			: null,
		extra.putts !== null
			? { label: t.rounds.putts, value: String(extra.putts) }
			: null,
		extra.fairways
			? {
					label: t.rounds.fairways,
					value: `${extra.fairways.hit}/${extra.fairways.of}`,
				}
			: null,
		extra.greens
			? {
					label: t.rounds.greens,
					value: `${extra.greens.hit}/${extra.greens.of}`,
				}
			: null,
	].filter((tile): tile is { label: string; value: string; sub?: string } =>
		Boolean(tile),
	);

	const dateText = new Date(round.startedAt).toLocaleDateString(
		dateLocale(locale),
		{ weekday: "long", day: "numeric", month: "long", year: "numeric" },
	);

	function onShare() {
		const lines = [
			`⛳ ${course.name}`,
			[dateText, round.loopLabel, tee.name].filter(Boolean).join(" · "),
			"",
			tiles
				.slice(0, 4)
				.map((tile) =>
					[tile.label, tile.value, tile.sub && `(${tile.sub})`]
						.filter(Boolean)
						.join(" "),
				)
				.join(" · "),
			recap.nines.length > 1
				? recap.nines.map((n, i) => `${nineLabels[i]} ${n.strokes}`).join(" · ")
				: null,
			markOrder
				.filter((m) => recap.marks[m] > 0)
				.map((m) => `${t.rounds.markShort[m]} ${recap.marks[m]}`)
				.join(" · "),
			tiles
				.slice(4)
				.map((tile) => `${tile.label} ${tile.value}`)
				.join(" · ") || null,
			"",
			t.rounds.shareFooter,
		].filter((line) => line !== null);
		Share.share({ message: lines.join("\n") }).catch(() => {});
	}

	async function onDelete() {
		const ok = await confirm({
			title: t.rounds.deleteTitle,
			message: t.rounds.deleteMessage,
			confirmLabel: t.rounds.delete,
			destructive: true,
		});
		if (!ok) return;
		setBusy(true);
		setError(null);
		try {
			await remove({ roundId: round._id });
			router.back();
		} catch (e) {
			setError(convexErrorMessage(e, t.rounds.deleteError));
			setBusy(false);
		}
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			<ScreenHeader
				title={t.rounds.detailTitle}
				action={
					recap.scored > 0
						? { label: t.rounds.share, onPress: onShare }
						: undefined
				}
			/>
			<View style={styles.heading}>
				<AppText variant="heading">{course.name}</AppText>
				<AppText variant="secondary">
					{[
						dateText,
						round.loopLabel,
						tee.name,
						round.format === "stableford"
							? t.rounds.stableford
							: t.rounds.strokePlay,
						round.status === "active" ? t.rounds.inProgress : null,
					]
						.filter(Boolean)
						.join(" · ")}
				</AppText>
			</View>
			<View style={styles.tiles}>
				{tiles.map((tile) => (
					<View key={tile.label} style={styles.tile}>
						<AppText variant="footnote">{tile.label}</AppText>
						<AppText variant="title" style={styles.tileValue}>
							{tile.value}
							{tile.sub ? (
								<AppText variant="footnote">{` ${tile.sub}`}</AppText>
							) : null}
						</AppText>
					</View>
				))}
			</View>
			{recap.scored > 0 ? (
				<View style={styles.recap}>
					<AppText variant="label">{t.rounds.recap}</AppText>
					<View style={styles.marks}>
						{markOrder.map((m) => (
							<View key={m} style={styles.mark}>
								<AppText variant="title" style={styles.tileValue}>
									{recap.marks[m]}
								</AppText>
								<AppText variant="footnote">{t.rounds.markShort[m]}</AppText>
							</View>
						))}
					</View>
					{recap.best ? (
						<RecapLine
							label={t.rounds.bestHole}
							value={holeResult(recap.best)}
						/>
					) : null}
					{recap.toughest ? (
						<RecapLine
							label={t.rounds.toughestHole}
							value={holeResult(recap.toughest)}
						/>
					) : null}
					{recap.nines.length > 1
						? recap.nines.map((n, i) => (
								<RecapLine
									key={nineLabels[i]}
									label={nineLabels[i]}
									value={`${n.strokes} (${vsPar(n.toPar)})`}
								/>
							))
						: null}
				</View>
			) : null}
			<ScorecardGrid holes={holes} players={round.players} rows={rows} />
			{error ? (
				<AppText selectable accessibilityRole="alert" style={styles.error}>
					{error}
				</AppText>
			) : null}
			{round.status === "finished" ? (
				<GhostButton
					label={t.rounds.delete}
					onPress={onDelete}
					loading={busy}
					disabled={busy}
					tone="danger"
				/>
			) : null}
		</ScrollView>
	);
}

const markOrder = ["eagle", "birdie", "par", "bogey", "double"] as const;

function RecapLine({ label, value }: { label: string; value: string }) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.recapLine}>
			<AppText variant="secondary">{label}</AppText>
			<AppText style={styles.tileValue}>{value}</AppText>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		content: {
			paddingHorizontal: metrics.screenGutter,
			paddingTop: spacing.md,
			paddingBottom: spacing.xxl,
			gap: spacing.lg,
		},
		heading: { gap: spacing.xs },
		tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
		tile: {
			flexGrow: 1,
			flexBasis: "30%",
			padding: spacing.md,
			gap: 2,
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
		},
		tileValue: { fontVariant: ["tabular-nums"] },
		error: { color: colors.danger },
		recap: {
			gap: spacing.sm,
			padding: spacing.md,
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
		},
		marks: { flexDirection: "row", justifyContent: "space-between" },
		mark: { alignItems: "center", flex: 1, gap: 2 },
		recapLine: {
			flexDirection: "row",
			justifyContent: "space-between",
			gap: spacing.md,
		},
	});
