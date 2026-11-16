import { holeLabel } from "@fairway/core/format";
import { wouldBeFromHistory } from "@fairway/core/handicap";
import { playedHoles } from "@fairway/core/round";
import { useMutation } from "convex/react";
import { useNavigation, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { convexErrorMessage } from "../../../convex/error-message";
import { useQuery } from "../../../convex/query-cache";
import { dateLocale, fmt, useI18n } from "../../../i18n";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../../theme";
import { GhostButton, PrimaryButton } from "../../../ui/button";
import { useConfirm } from "../../../ui/confirm-dialog";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { SkeletonCard } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { useAppUpdate } from "../../../updates/use-app-update";
import { RoundRow } from "../../rounds/components/round-row";
import { useActiveRound } from "../../rounds/use-active-round";
import { useEndSimulation } from "../../simulation/mode/use-end-simulation";

const RECENT = 3;

export function HomeSummaryScreen() {
	const router = useRouter();
	const navigation = useNavigation();
	const styles = useThemedStyles(createStyles);
	const { t, locale, numbers } = useI18n();
	const active = useActiveRound();
	const settings = useQuery(api.settings.get);
	const history = useQuery(api.rounds.history, {});
	const update = useAppUpdate();
	const confirm = useConfirm();
	const toast = useToast();
	const abandon = useMutation(api.rounds.abandon);
	const endSimulation = useEndSimulation();
	const [stopping, setStopping] = useState(false);

	const wouldBe = wouldBeFromHistory(history ?? []);
	const recent = history?.slice(0, RECENT) ?? [];
	const index = settings?.handicapIndex ?? null;
	const progress = active
		? {
				hole: holeLabel(active.holes[active.round.currentHoleIndex]?.ref ?? ""),
				n: playedHoles(active.holes.length, active.scores).length,
				total: active.holes.length,
			}
		: null;

	/** A stale round blocks a new one: resume it, or stop it and start over. */
	async function onStartNew() {
		if (!active || !progress) return;
		const { round, course } = active;
		const stop = await confirm({
			title: t.home.newRoundTitle,
			message: fmt(t.home.newRoundMessage, {
				course: course.name,
				n: progress.n,
				total: progress.total,
			}),
			confirmLabel: t.home.stopRound,
			destructive: true,
			alternative: {
				label: t.home.resume,
				onPress: () => router.push("/play"),
			},
		});
		if (!stop) return;
		// Not `useSubmit`: Home stays mounted under the picker, so pending
		// must clear after a success too.
		setStopping(true);
		try {
			await abandon({ roundId: round._id });
			if (round.simulated) endSimulation();
			// A slow stop must not yank the user away from where they went since.
			if (navigation.isFocused()) router.push("/courses");
		} catch (e) {
			toast.error(convexErrorMessage(e, t.home.stopError));
		} finally {
			setStopping(false);
		}
	}

	return (
		<ScrollView
			testID="home-summary"
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
							{active.round.simulated
								? t.home.resumeSimulation
								: t.home.resumeTitle}
						</AppText>
						<AppText variant="heading" style={styles.onAccent}>
							{active.course.name}
						</AppText>
						<AppText variant="footnote" style={styles.onAccent}>
							{progress ? fmt(t.home.resumeDetail, progress) : null}
						</AppText>
					</View>
					<AppText variant="control" style={styles.onAccent}>
						{t.home.resume}
					</AppText>
				</Pressable>
			) : null}

			{update.ready ? (
				<InsetList>
					<InsetRow
						leading={{ symbol: "arrow.down.circle.fill" }}
						title={t.home.updateReady}
						secondary={t.home.updateReadyHint}
						onPress={update.restart}
					/>
				</InsetList>
			) : null}

			<Pressable
				accessibilityRole="button"
				accessibilityHint={t.home.handicapEdit}
				onPress={() => router.push("/profile/handicap")}
				style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
			>
				<AppText variant="label">{t.home.handicap}</AppText>
				{settings === undefined ? (
					<SkeletonCard lines={1} />
				) : (
					<AppText
						variant={index === null ? "title" : "quantity"}
						style={styles.heroValue}
					>
						{index === null ? t.home.handicapUnset : numbers.handicap(index)}
					</AppText>
				)}
				{wouldBe.index !== null ? (
					<AppText variant="footnote">
						{fmt(t.home.wouldBe, {
							value: numbers.handicap(wouldBe.index),
						})}
						{" · "}
						{fmt(t.home.wouldBeHint, { count: wouldBe.counted })}
					</AppText>
				) : index === null && settings !== undefined ? (
					<AppText variant="footnote">{t.home.handicapUnsetHint}</AppText>
				) : null}
			</Pressable>

			{active === null ? (
				<PrimaryButton
					size="lg"
					label={t.home.startRound}
					onPress={() => router.push("/courses")}
				/>
			) : active ? (
				<GhostButton
					label={t.home.startNewRound}
					onPress={onStartNew}
					loading={stopping}
				/>
			) : null}

			{history === undefined ? (
				<SkeletonCard lines={2} />
			) : recent.length > 0 ? (
				<InsetList header={t.home.recentRounds}>
					{recent.map((round) => (
						<RoundRow
							key={round._id}
							round={round}
							secondary={[
								new Date(round.startedAt).toLocaleDateString(
									dateLocale(locale),
									{ day: "numeric", month: "long" },
								),
								round.holeCount === 9 ? t.home.nineHoles : null,
							]
								.filter(Boolean)
								.join(" · ")}
						/>
					))}
					{history.length > recent.length ? (
						<InsetRow
							title={t.home.allRounds}
							chevron
							onPress={() => router.navigate("/rounds")}
						/>
					) : null}
				</InsetList>
			) : (
				<InsetList header={t.home.recentRounds}>
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
