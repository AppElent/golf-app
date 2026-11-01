/**
 * Stats: the would-be index and its trend, pooled averages over the last 20
 * rounds, scoring by par, the scoring distribution and club distances (the
 * bag's carry next to what marked shots say).
 */
import { formatDistance } from "@fairway/core/format";
import { parTypeAverages, scoringDistribution } from "@fairway/core/par-stats";
import { formatVsPar } from "@fairway/core/scoring";
import { aggregateStats } from "@fairway/core/stats";
import { ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { fmt, localizeDecimal, plural, useI18n } from "../../../i18n";
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
import { wouldBeFromHistory } from "../../home/summary/home-summary-model";
import {
	clubRows,
	type DistributionKey,
	distributionShares,
	statInputs,
	wouldBeTrend,
} from "./stats-model";

export function StatsScreen() {
	const { t, locale } = useI18n();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const history = useQuery(api.rounds.history, { limit: 20 });
	const results = useQuery(api.rounds.holeResults, { limit: 20 });
	const clubs = useQuery(api.clubs.list);
	const shots = useQuery(api.shots.mine);
	const settings = useQuery(api.settings.get);
	const units = settings?.units ?? "m";

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

	const decimal = (n: number) => localizeDecimal(n.toFixed(1), locale);
	const toPar = (v: number | null) =>
		v === null ? "—" : localizeDecimal(formatVsPar(v), locale);
	const pct = (v: number | null) =>
		v === null ? "—" : `${Math.round(v * 100)}%`;
	const wouldBe = wouldBeFromHistory(history);
	const trend = wouldBeTrend(history);
	const stats = aggregateStats(statInputs(history));
	const parTypes = results ? parTypeAverages(results) : null;
	const distribution = results
		? distributionShares(scoringDistribution(results))
		: null;
	const bag = clubs && shots ? clubRows(clubs, shots) : null;
	const bucketColor: Record<DistributionKey, string> = {
		eagles: colors.tileOrange,
		birdies: course.birdie,
		pars: colors.accentFill,
		bogeys: colors.textMuted,
		doubles: colors.text,
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
						variant={wouldBe ? "quantity" : "title"}
						style={styles.heroValue}
					>
						{wouldBe ? decimal(wouldBe.value) : "—"}
					</AppText>
					<AppText variant="footnote">
						{wouldBe
							? fmt(t.stats.wouldBeHint, { count: wouldBe.count })
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

			<InsetList compact header={t.stats.averages}>
				<InsetRow title={t.stats.rounds} value={String(stats.rounds)} />
				{stats.avgScore !== null || stats.avgScore9 === null ? (
					<>
						<InsetRow
							title={t.stats.avgScore}
							value={stats.avgScore === null ? "—" : decimal(stats.avgScore)}
						/>
						<InsetRow title={t.stats.avgToPar} value={toPar(stats.avgVsPar)} />
					</>
				) : null}
				{stats.avgScore9 !== null ? (
					<>
						<InsetRow
							title={t.stats.avgScore9}
							value={decimal(stats.avgScore9)}
						/>
						<InsetRow
							title={t.stats.avgToPar9}
							value={toPar(stats.avgVsPar9)}
						/>
					</>
				) : null}
				<InsetRow
					title={t.stats.puttsPer18}
					value={stats.puttsPer18 === null ? "—" : decimal(stats.puttsPer18)}
				/>
				<InsetRow title={t.stats.fairways} value={pct(stats.firPct)} />
				<InsetRow title={t.stats.greens} value={pct(stats.girPct)} />
			</InsetList>

			{parTypes ? (
				<InsetList compact header={t.stats.parTypes}>
					{parTypes.map((p) => (
						<InsetRow
							key={p.par}
							id={`par-${p.par}`}
							title={fmt(t.stats.parN, { n: p.par })}
							secondary={
								p.average === null
									? undefined
									: localizeDecimal(
											formatVsPar(Number((p.average - p.par).toFixed(1))),
											locale,
										)
							}
							value={
								p.average === null
									? "—"
									: localizeDecimal(p.average.toFixed(2), locale)
							}
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
				<InsetList compact header={t.stats.clubs} footer={t.stats.clubsHint}>
					{bag.map((club) => (
						<InsetRow
							key={club.name}
							id={club.name}
							title={club.name}
							secondary={
								club.learned
									? [
											fmt(t.stats.typical, {
												// "142–156 m": the unit once.
												low: formatDistance(
													club.learned.lowMeters,
													units,
												).split(" ")[0],
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
			) : null}
		</ScrollView>
	);
}

/** Lower index is better, so it draws higher. */
function Sparkline({
	values,
	color,
	label,
	width = 120,
	height = 44,
}: {
	values: readonly number[];
	color: string;
	label: string;
	width?: number;
	height?: number;
}) {
	const min = Math.min(...values);
	const span = Math.max(...values) - min || 1;
	const pad = 4;
	const step = (width - pad * 2) / (values.length - 1);
	const points = values.map((v, i) => ({
		x: pad + i * step,
		y: pad + (height - pad * 2) * ((v - min) / span),
	}));
	const d = points
		.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
		.join(" ");
	const last = points[points.length - 1];
	return (
		<Svg
			width={width}
			height={height}
			accessibilityRole="image"
			accessibilityLabel={label}
		>
			<Path
				d={d}
				stroke={color}
				strokeWidth={2.5}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
			<Circle cx={last.x} cy={last.y} r={3.5} fill={color} />
		</Svg>
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
		// Lines up with the inset lists' own section headers.
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
