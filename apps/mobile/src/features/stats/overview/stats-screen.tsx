import { distanceValue, formatDistance } from "@fairway/core/format";
import { wouldBeFromHistory } from "@fairway/core/handicap";
import { parTypeAverages, scoringDistribution } from "@fairway/core/par-stats";
import type { ScoreMark } from "@fairway/core/scoring";
import { aggregateStats } from "@fairway/core/stats";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { fmt, plural, useI18n } from "../../../i18n";
import {
	course,
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { EmptyState } from "../../../ui/empty-state";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { SkeletonCard } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { useUnits } from "../../profile/use-units";
import { Sparkline } from "./sparkline";
import { clubRows, distributionShares } from "./stats-model";

export function StatsScreen() {
	const router = useRouter();
	const { t, locale, numbers } = useI18n();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const history = useQuery(api.rounds.history, {});
	const results = useQuery(api.rounds.holeResults, {});
	const clubs = useQuery(api.clubs.list);
	const shots = useQuery(api.shots.mine);
	const units = useUnits();

	if (history === undefined) {
		return (
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={styles.content}
			>
				<SkeletonCard lines={2} />
				<SkeletonCard lines={4} />
			</ScrollView>
		);
	}
	if (history.length === 0) {
		return <EmptyState title={t.stats.empty} body={t.stats.emptyHint} />;
	}

	const toPar = (v: number | null) => (v === null ? "—" : numbers.vsPar(v));
	const pct = (v: number | null) =>
		v === null ? "—" : `${Math.round(v * 100)}%`;
	const { index: wouldBe, counted, trend } = wouldBeFromHistory(history);
	const stats = aggregateStats(history);
	const parTypes = results ? parTypeAverages(results) : null;
	const distribution = results
		? distributionShares(scoringDistribution(results))
		: null;
	const bag = clubs && shots ? clubRows(clubs, shots) : null;
	const bucketColor: Record<ScoreMark, string> = {
		eagle: colors.eagle,
		birdie: course.birdie,
		par: colors.accentFill,
		bogey: colors.textMuted,
		double: colors.text,
	};

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			<View style={styles.hero}>
				<View style={styles.heroText}>
					<AppText variant="label">{t.stats.wouldBe}</AppText>
					<AppText
						variant={wouldBe !== null ? "quantity" : "title"}
						style={styles.heroValue}
					>
						{wouldBe !== null ? numbers.handicap(wouldBe) : "—"}
					</AppText>
					<AppText variant="footnote">
						{wouldBe !== null
							? fmt(t.stats.wouldBeHint, { count: counted })
							: t.stats.wouldBeNeeds}
					</AppText>
				</View>
				{trend.length >= 2 ? (
					<Sparkline
						values={trend}
						color={colors.accent}
						label={t.stats.trend}
					/>
				) : null}
			</View>

			<InsetList header={t.stats.averages}>
				<InsetRow title={t.stats.rounds} value={String(stats.rounds)} />
				{stats.avgScore !== null || stats.avgScore9 === null ? (
					<>
						<InsetRow
							title={t.stats.avgScore}
							value={
								stats.avgScore === null ? "—" : numbers.decimal(stats.avgScore)
							}
						/>
						<InsetRow title={t.stats.avgToPar} value={toPar(stats.avgVsPar)} />
					</>
				) : null}
				{stats.avgScore9 !== null ? (
					<>
						<InsetRow
							title={t.stats.avgScore9}
							value={numbers.decimal(stats.avgScore9)}
						/>
						<InsetRow
							title={t.stats.avgToPar9}
							value={toPar(stats.avgVsPar9)}
						/>
					</>
				) : null}
				<InsetRow
					title={t.stats.puttsPer18}
					value={
						stats.puttsPer18 === null ? "—" : numbers.decimal(stats.puttsPer18)
					}
				/>
				<InsetRow title={t.stats.fairways} value={pct(stats.firPct)} />
				<InsetRow title={t.stats.greens} value={pct(stats.girPct)} />
			</InsetList>

			{parTypes ? (
				<InsetList header={t.stats.parTypes}>
					{parTypes.map((p) => (
						<InsetRow
							key={p.par}
							title={fmt(t.stats.parN, { n: p.par })}
							secondary={
								p.average === null
									? undefined
									: numbers.vsPar(p.average - p.par, 1)
							}
							value={p.average === null ? "—" : numbers.decimal(p.average, 2)}
						/>
					))}
				</InsetList>
			) : null}

			{distribution ? (
				<View style={styles.section}>
					<AppText variant="secondary" style={styles.sectionHeader}>
						{t.stats.distribution}
					</AppText>
					<View style={styles.card}>
						{distribution.map((bucket) => (
							<View
								key={bucket.key}
								style={styles.barRow}
								accessible
								accessibilityLabel={`${t.stats[bucket.key]}: ${bucket.count}, ${pct(bucket.share)}`}
							>
								<AppText style={styles.barLabel}>{t.stats[bucket.key]}</AppText>
								<View style={styles.barTrack}>
									<View
										style={[
											styles.bar,
											{
												width: `${Math.max(bucket.share * 100, bucket.count > 0 ? 2 : 0)}%`,
												backgroundColor: bucketColor[bucket.key],
											},
										]}
									/>
								</View>
								<AppText variant="footnote" style={styles.barValue}>
									{pct(bucket.share)}
								</AppText>
							</View>
						))}
					</View>
				</View>
			) : null}

			{bag && bag.length > 0 ? (
				<InsetList header={t.stats.clubs} footer={t.stats.clubsHint}>
					{bag.map((club) => (
						<InsetRow
							key={club.name}
							title={club.name}
							secondary={
								club.learned
									? [
											fmt(t.stats.typical, {
												low: distanceValue(club.learned.lowMeters, units),
												high: formatDistance(club.learned.highMeters, units),
											}),
											plural(locale, club.learned.shots, t.stats.clubShots),
										]
											.filter(Boolean)
											.join(" · ")
									: undefined
							}
							value={formatDistance(
								club.learned?.medianMeters ?? club.carryMeters,
								units,
							)}
						/>
					))}
				</InsetList>
			) : bag ? (
				<InsetList header={t.stats.clubs}>
					<InsetRow
						title={t.stats.noBag}
						secondary={t.stats.noBagHint}
						chevron
						onPress={() => router.navigate("/profile/clubs")}
					/>
				</InsetList>
			) : null}
		</ScrollView>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		content: {
			paddingHorizontal: metrics.screenGutter,
			paddingBottom: spacing.xxl,
			gap: spacing.lg,
		},
		hero: {
			flexDirection: "row",
			alignItems: "flex-end",
			gap: spacing.md,
			padding: spacing.lg,
			borderRadius: radius.cardLg,
			backgroundColor: colors.surface,
		},
		heroText: { flex: 1, gap: spacing.xs },
		heroValue: { fontVariant: ["tabular-nums"] },
		section: { gap: spacing.sm },
		sectionHeader: { paddingHorizontal: spacing.md, color: colors.textMuted },
		card: {
			padding: spacing.md,
			gap: spacing.sm,
			borderRadius: radius.lg,
			backgroundColor: colors.surface,
		},
		barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
		barLabel: { width: 132 },
		barTrack: {
			flex: 1,
			height: 10,
			borderRadius: radius.pill,
			backgroundColor: colors.accentDim,
			overflow: "hidden",
		},
		bar: { height: "100%", borderRadius: radius.pill },
		barValue: { width: 40, textAlign: "right", fontVariant: ["tabular-nums"] },
	});
