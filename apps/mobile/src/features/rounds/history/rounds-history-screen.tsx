/**
 * Rounds: every finished round, newest first, a section per month. Tap for
 * the scorecard; swipe or long-press to delete (confirmed). Everything is a
 * read of Convex — nothing about past rounds is kept on the phone.
 */
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { dateLocale, fmt, useI18n } from "../../../i18n";
import { metrics, spacing } from "../../../theme";
import { convexErrorMessage, useConfirm } from "../../../ui/confirm-dialog";
import { EmptyState } from "../../../ui/empty-state";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { SkeletonList } from "../../../ui/skeleton";
import { useToast } from "../../../ui/toast";
import { groupByMonth, scoreLabel } from "./history-model";

export function RoundsHistoryScreen() {
	const { t, locale } = useI18n();
	const router = useRouter();
	const confirm = useConfirm();
	const toast = useToast();
	const history = useQuery(api.rounds.history, { limit: 200 });
	const remove = useMutation(api.rounds.remove);

	if (history === undefined) {
		return (
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={styles.content}
			>
				<SkeletonList rows={5} />
			</ScrollView>
		);
	}
	if (history.length === 0) {
		return <EmptyState title={t.rounds.empty} body={t.rounds.emptyHint} />;
	}

	async function onDelete(roundId: Id<"rounds">) {
		const ok = await confirm({
			title: t.rounds.deleteTitle,
			message: t.rounds.deleteMessage,
			confirmLabel: t.rounds.delete,
			destructive: true,
		});
		if (!ok) return;
		try {
			await remove({ roundId });
		} catch (e) {
			toast.error(convexErrorMessage(e, t.rounds.deleteError));
		}
	}

	const locale_ = dateLocale(locale);
	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			{groupByMonth(history, locale_).map((section) => (
				<View key={section.key}>
					<InsetList compact header={section.title}>
						{section.rounds.map((round) => (
							<InsetRow
								key={round._id}
								id={round._id}
								title={round.courseName}
								secondary={[
									new Date(round.startedAt).toLocaleDateString(locale_, {
										weekday: "short",
										day: "numeric",
									}),
									round.loopLabel ??
										fmt(t.rounds.holes, { n: round.holeCount }),
								].join(" · ")}
								value={scoreLabel(round.owner)}
								chevron
								onPress={() => router.push(`/rounds/${round._id}`)}
								actions={[
									{
										key: "delete",
										label: t.common.delete,
										systemImage: "trash",
										destructive: true,
										onPress: () => void onDelete(round._id),
									},
								]}
							/>
						))}
					</InsetList>
				</View>
			))}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: metrics.screenGutter,
		paddingBottom: spacing.xxl,
		gap: spacing.lg,
	},
});
