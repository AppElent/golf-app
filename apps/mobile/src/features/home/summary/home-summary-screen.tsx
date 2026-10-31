/**
 * Home: the resume card while a round is live, the handicap hero, "Start
 * round" and the last finished round. Everything here is a read of Convex;
 * nothing is stored on the phone.
 */
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { dateLocale, fmt, localizeDecimal, useI18n } from "../../../i18n";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../../theme";
import { PrimaryButton } from "../../../ui/button";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { SkeletonCard } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { vsParLabel, wouldBeFromHistory } from "./home-summary-model";

export function HomeSummaryScreen() {
	const router = useRouter();
	const styles = useThemedStyles(createStyles);
	const { t, locale } = useI18n();
	const active = useQuery(api.rounds.active);
	const settings = useQuery(api.settings.get);
	const history = useQuery(api.rounds.history, { limit: 20 });

	const wouldBe = history ? wouldBeFromHistory(history) : null;
	const last = history?.[0];
	const index = settings?.handicapIndex ?? null;

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			{active ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${t.home.resumeTitle}. ${active.course.name}`}
					onPress={() => router.push("/play")}
					style={({ pressed }) => [styles.resume, pressed && styles.pressed]}
				>
					<View style={styles.resumeText}>
						<AppText variant="label" style={styles.resumeEyebrow}>
							{t.home.resumeTitle}
						</AppText>
						<AppText variant="heading" style={styles.onAccent}>
							{active.course.name}
						</AppText>
						<AppText variant="footnote" style={styles.onAccent}>
							{fmt(t.home.resumeDetail, {
								hole: (active.round.currentHoleIndex ?? 0) + 1,
								total: active.holes.length,
							})}
						</AppText>
					</View>
					<AppText variant="control" style={styles.onAccent}>
						{t.home.resume}
					</AppText>
				</Pressable>
			) : null}

			<View style={styles.hero}>
				<AppText variant="label">{t.home.handicap}</AppText>
				{settings === undefined ? (
					<SkeletonCard lines={1} />
				) : (
					<AppText
						variant={index === null ? "title" : "quantity"}
						style={styles.heroValue}
					>
						{index === null
							? t.home.handicapUnset
							: localizeDecimal(index.toFixed(1), locale)}
					</AppText>
				)}
				{wouldBe ? (
					<AppText variant="footnote">
						{fmt(t.home.wouldBe, {
							value: localizeDecimal(wouldBe.value.toFixed(1), locale),
						})}
						{" · "}
						{fmt(t.home.wouldBeHint, { count: wouldBe.count })}
					</AppText>
				) : null}
			</View>

			{active === null ? (
				<PrimaryButton
					size="lg"
					label={t.home.startRound}
					onPress={() => router.push("/courses")}
				/>
			) : null}

			{history === undefined ? (
				<SkeletonCard lines={2} />
			) : last ? (
				<InsetList compact header={t.home.lastRound}>
					<InsetRow
						id={last._id}
						title={last.courseName}
						secondary={new Date(last.startedAt).toLocaleDateString(
							dateLocale(locale),
							{ day: "numeric", month: "long" },
						)}
						value={
							last.owner.strokes > 0
								? `${last.owner.strokes} (${vsParLabel(last.owner.vsPar)})`
								: undefined
						}
						chevron
						onPress={() => router.push(`/rounds/${last._id}`)}
					/>
				</InsetList>
			) : (
				<InsetList compact header={t.home.lastRound}>
					<InsetRow title={t.home.noRounds} secondary={t.home.noRoundsHint} />
				</InsetList>
			)}
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
		resume: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
			padding: spacing.md,
			borderRadius: radius.cardLg,
			backgroundColor: colors.accentFill,
		},
		pressed: { opacity: 0.85 },
		resumeText: { flex: 1, gap: 2 },
		resumeEyebrow: { color: colors.onAccent, opacity: 0.8 },
		onAccent: { color: colors.onAccent },
		hero: {
			gap: spacing.xs,
			padding: spacing.lg,
			borderRadius: radius.cardLg,
			backgroundColor: colors.surface,
		},
		heroValue: { fontVariant: ["tabular-nums"] },
	});
