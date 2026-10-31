/**
 * The live scorecard (from Play): every hole and player so far, totals per
 * player, tap a hole to correct it, and the two ways a round ends — finish
 * (stores totals and the handicap differential) or abandon (deletes it).
 */
import { useMutation } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Button, Platform, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { GhostButton } from "../../../ui/button";
import { convexErrorMessage, useConfirm } from "../../../ui/confirm-dialog";
import { EmptyState } from "../../../ui/empty-state";
import { FormScreen } from "../../../ui/form";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { cardRows, unscoredHoles } from "./score-model";
import { ScorecardGrid } from "./scorecard-grid";

export function ScorecardScreen() {
	const { t } = useI18n();
	const router = useRouter();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const confirm = useConfirm();
	const active = useQuery(api.rounds.active, {});
	const finish = useMutation(api.rounds.finish);
	const abandon = useMutation(api.rounds.abandon);
	const [busy, setBusy] = useState<"finish" | "abandon" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const header = (
		<>
			<Stack.Screen
				options={{
					title: t.scorecard.title,
					...(Platform.OS !== "ios"
						? {
								headerLeft: () => (
									<Button
										title={t.common.done}
										onPress={() => router.back()}
										color={colors.accent}
									/>
								),
							}
						: {}),
				}}
			/>
			{Platform.OS === "ios" ? (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button onPress={() => router.back()}>
						{t.common.done}
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
		</>
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
				<EmptyState
					title={t.play.noRound}
					body={t.play.noRoundHint}
					action={{ label: t.common.done, onPress: () => router.back() }}
				/>
			</>
		);
	}

	const { round, holes, scores, course } = active;
	const rows = cardRows(holes, scores, round.players);
	const missing = unscoredHoles(holes.length, scores).length;
	const roundId = round._id;

	async function onFinish() {
		const ok = await confirm({
			title: t.scorecard.finishTitle,
			message:
				missing > 0
					? fmt(t.scorecard.finishMissing, { count: missing })
					: t.scorecard.finishMessage,
			confirmLabel: t.scorecard.finish,
		});
		if (!ok) return;
		setBusy("finish");
		setError(null);
		try {
			await finish({ roundId });
			haptics.entryLogged();
			router.dismissAll();
			router.push({
				pathname: "/rounds/[roundId]",
				params: { roundId },
			});
		} catch (e) {
			setError(convexErrorMessage(e, t.scorecard.finishError));
			setBusy(null);
		}
	}

	async function onAbandon() {
		const ok = await confirm({
			title: t.scorecard.abandonTitle,
			message: t.scorecard.abandonMessage,
			confirmLabel: t.scorecard.abandon,
			destructive: true,
		});
		if (!ok) return;
		setBusy("abandon");
		setError(null);
		try {
			await abandon({ roundId });
			router.dismissAll();
		} catch (e) {
			setError(convexErrorMessage(e, t.scorecard.abandonError));
			setBusy(null);
		}
	}

	return (
		<>
			{header}
			<FormScreen
				avoidKeyboard={false}
				primaryAction={{
					label: t.scorecard.finish,
					onPress: onFinish,
					loading: busy === "finish",
					disabled: busy !== null,
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
					currentHole={round.currentHoleIndex ?? 0}
					onHolePress={(hole) =>
						router.push({
							pathname: "/score",
							params: { hole: String(hole) },
						})
					}
				/>
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
					loading={busy === "abandon"}
					disabled={busy !== null}
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
