import { playedHoles } from "@fairway/core/round";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useSubmit } from "../../../convex/use-submit";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
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
import { useSimulationMode } from "../../simulation/mode/use-simulation-mode";
import { NoActiveRound } from "../components/no-active-round";
import { ScorecardGrid } from "../components/scorecard-grid";
import { cardRows } from "../components/scorecard-model";
import { useActiveRound } from "../use-active-round";

export function ScorecardScreen() {
	const { t, locale } = useI18n();
	const router = useRouter();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const confirm = useConfirm();
	const active = useActiveRound();
	const { setSimulating } = useSimulationMode();
	const finish = useMutation(api.rounds.finish);
	const abandon = useMutation(api.rounds.abandon);
	const submit = useSubmit();
	const [action, setAction] = useState<"finish" | "abandon">("finish");

	const header = (
		<NavHeader
			title={t.scorecard.title}
			left={{ label: t.common.done, onPress: () => router.back() }}
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
	const rows = cardRows(holes, scores, round.players);
	const missing = holes.length - playedHoles(holes.length, scores).length;
	const roundId = round._id;

	async function onFinish() {
		const ok = await confirm({
			title: t.scorecard.finishTitle,
			message: round.simulated
				? t.scorecard.finishSimulationMessage
				: missing > 0
					? plural(locale, missing, t.scorecard.finishMissing)
					: t.scorecard.finishMessage,
			confirmLabel: t.scorecard.finish,
		});
		if (!ok) return;
		setAction("finish");
		await submit.run(() => finish({ roundId }), {
			errorFallback: t.scorecard.finishError,
			onSuccess: () => {
				haptics.saveConfirmed();
				if (round.simulated) {
					setSimulating(false);
					router.dismissAll();
					return;
				}
				router.dismissAll();
				router.push({
					pathname: "/rounds/[roundId]",
					params: { roundId },
				});
			},
		});
	}

	async function onAbandon() {
		const ok = await confirm({
			title: t.scorecard.abandonTitle,
			message: t.scorecard.abandonMessage,
			confirmLabel: t.scorecard.abandon,
			destructive: true,
		});
		if (!ok) return;
		setAction("abandon");
		await submit.run(() => abandon({ roundId }), {
			errorFallback: t.scorecard.abandonError,
			onSuccess: () => {
				if (round.simulated) setSimulating(false);
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
					onPress: onFinish,
					loading: submit.pending && action === "finish",
					disabled: submit.pending,
				}}
			>
				<View style={styles.heading}>
					<AppText variant="heading">{course.name}</AppText>
					{round.loopLabel ? (
						<AppText variant="secondary">{round.loopLabel}</AppText>
					) : null}
				</View>
				<View style={styles.totals}>
					{round.players.map((player, p) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: players are fixed at round start
						<View key={p} style={styles.total}>
							<AppText variant="label" numberOfLines={1}>
								{player.name}
							</AppText>
							<AppText variant="title" style={styles.totalNumber}>
								{rows[p].scored > 0 ? rows[p].total : "–"}
							</AppText>
							<AppText variant="footnote">
								{[
									rows[p].toPar,
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
				<ScorecardGrid
					holes={holes}
					players={round.players}
					rows={rows}
					currentHole={round.currentHoleIndex}
					onHolePress={(hole) =>
						router.push({
							pathname: "/score",
							params: { hole: String(hole) },
						})
					}
				/>
				{submit.error ? (
					<AppText
						selectable
						accessibilityRole="alert"
						style={{ color: colors.danger }}
					>
						{submit.error}
					</AppText>
				) : null}
				<GhostButton
					label={t.scorecard.abandon}
					onPress={onAbandon}
					loading={submit.pending && action === "abandon"}
					disabled={submit.pending}
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
