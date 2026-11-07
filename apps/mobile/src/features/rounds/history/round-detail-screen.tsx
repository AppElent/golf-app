import { roundRecap } from "@fairway/core/recap";
import { OWNER_INDEX, ownerRoundStats } from "@fairway/core/round";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ComponentRef, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { dateLocale, useI18n } from "../../../i18n";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../../theme";
import { GhostButton } from "../../../ui/button";
import { EmptyState } from "../../../ui/empty-state";
import { NavHeader } from "../../../ui/nav-header";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { ScorecardGrid } from "../components/scorecard-grid";
import { cardRows } from "../components/scorecard-model";
import {
	markCounts,
	roundTiles,
	shareCardStats,
	shareMessage,
} from "./round-detail-model";
import { RoundRecapCard } from "./round-recap-card";
import { shareRound } from "./round-share";
import { ShareCard } from "./share-card";
import { useDeleteRound } from "./use-delete-round";

export function RoundDetailScreen() {
	const { t, locale, numbers } = useI18n();
	const router = useRouter();
	const styles = useThemedStyles(createStyles);
	const { roundId } = useLocalSearchParams<{ roundId: string }>();
	const detail = useQuery(api.rounds.detail, {
		roundId: roundId as Id<"rounds">,
	});
	const remove = useDeleteRound({ onDeleted: () => router.back() });
	const cardRef = useRef<ComponentRef<typeof View>>(null);
	const header = <NavHeader title={t.rounds.detailTitle} />;

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
	const owner = rows[OWNER_INDEX];
	const recap = roundRecap(
		holes,
		owner.cells.map((c) => c.strokes),
		round.players[OWNER_INDEX]?.playingHandicap,
	);
	const nineLabels =
		recap.nines.length > 1
			? [t.scorecard.out, t.scorecard.in]
			: [t.scorecard.total];

	const tiles = roundTiles({
		owner,
		recap,
		extra: ownerRoundStats(holes, scores),
		format: round.format,
		holeCount: round.holeRefs.length,
		differential: round.scoreDifferential,
		decimal: numbers.decimal,
		vsPar: numbers.vsPar,
		copy: t.rounds,
	});

	const dateText = new Date(round.startedAt).toLocaleDateString(
		dateLocale(locale),
		{ weekday: "long", day: "numeric", month: "long", year: "numeric" },
	);
	const shareDetail = [dateText, round.loopLabel, tee.name]
		.filter(Boolean)
		.join(" · ");

	const ninesText =
		recap.nines.length > 1
			? recap.nines.map((n, i) => `${nineLabels[i]} ${n.strokes}`).join(" · ")
			: null;

	const onShare = () =>
		shareRound(
			cardRef,
			shareMessage({
				courseName: course.name,
				detail: shareDetail,
				tiles,
				ninesText,
				marks: recap.marks,
				copy: t.rounds,
			}),
		);

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			<NavHeader
				title={t.rounds.detailTitle}
				right={
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
				{[tiles.score, tiles.toPar, ...tiles.stats].map((tile) => (
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
				<RoundRecapCard
					recap={recap}
					holes={holes}
					nineLabels={nineLabels}
					vsPar={numbers.vsPar}
				/>
			) : null}
			<ScorecardGrid holes={holes} players={round.players} rows={rows} />
			{recap.scored > 0 ? (
				<View style={styles.offscreen} pointerEvents="none">
					<ShareCard
						ref={cardRef}
						course={course.name}
						detail={shareDetail}
						score={tiles.score.value}
						toPar={tiles.toPar.value}
						stats={shareCardStats(tiles)}
						marks={markCounts(recap.marks, t.rounds.markShort)}
						nines={ninesText}
					/>
				</View>
			) : null}
			{remove.error ? (
				<AppText selectable accessibilityRole="alert" style={styles.error}>
					{remove.error}
				</AppText>
			) : null}
			{round.status === "finished" ? (
				<GhostButton
					label={t.rounds.delete}
					onPress={() => void remove.deleteRound(round._id)}
					loading={remove.pending}
					disabled={remove.pending}
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
		// Rendered off-screen rather than hidden: view-shot needs it laid out.
		offscreen: { position: "absolute", left: -10_000, top: 0 },
	});
