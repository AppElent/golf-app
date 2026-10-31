/**
 * One round after the fact: where and when, the headline numbers (score, to
 * par, points, differential, putts, fairways, greens) and the full scorecard.
 * Read-only; deleting it is the one action, confirmed.
 */
import { useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { dateLocale, localizeDecimal, useI18n } from "../../../i18n";
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

	const tiles = [
		{
			label: t.rounds.score,
			value: owner.scored > 0 ? String(owner.total) : "–",
		},
		{ label: t.rounds.toPar, value: owner.toPar ?? "–" },
		round.format === "stableford"
			? { label: t.rounds.points, value: String(owner.points) }
			: null,
		round.scoreDifferential != null
			? {
					label: t.rounds.differential,
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
	].filter((tile) => tile !== null);

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
			{header}
			<View style={styles.heading}>
				<AppText variant="heading">{course.name}</AppText>
				<AppText variant="secondary">
					{[
						new Date(round.startedAt).toLocaleDateString(dateLocale(locale), {
							weekday: "long",
							day: "numeric",
							month: "long",
							year: "numeric",
						}),
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
						</AppText>
					</View>
				))}
			</View>
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
	});
