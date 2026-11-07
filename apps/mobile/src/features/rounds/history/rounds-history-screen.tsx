import { useMutation } from "convex/react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api, type Id } from "../../../convex/api";
import { convexErrorMessage } from "../../../convex/error-message";
import { useQuery } from "../../../convex/query-cache";
import { dateLocale, fmt, useI18n } from "../../../i18n";
import { metrics, spacing } from "../../../theme";
import { EmptyState } from "../../../ui/empty-state";
import { InsetList } from "../../../ui/inset-list";
import { SkeletonList } from "../../../ui/skeleton";
import { useToast } from "../../../ui/toast";
import { RoundRow } from "../components/round-row";
import { groupByMonth } from "./history-model";
import { useConfirmDeleteRound } from "./use-delete-round";

export function RoundsHistoryScreen() {
	const { t, locale } = useI18n();
	const toast = useToast();
	const history = useQuery(api.rounds.history, { limit: 200 });
	const confirmDelete = useConfirmDeleteRound();
	const remove = useMutation(api.rounds.remove);

	// Each row deletes on its own: one waiting for a connection blocks no other.
	async function deleteRound(roundId: Id<"rounds">) {
		if (!(await confirmDelete())) return;
		try {
			await remove({ roundId });
		} catch (e) {
			toast.error(convexErrorMessage(e, t.rounds.deleteError));
		}
	}

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

	const locale_ = dateLocale(locale);
	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			{groupByMonth(history, locale_).map((section) => (
				<View key={section.key}>
					<InsetList header={section.title}>
						{section.rounds.map((round) => (
							<RoundRow
								key={round._id}
								round={round}
								secondary={[
									new Date(round.startedAt).toLocaleDateString(locale_, {
										weekday: "short",
										day: "numeric",
									}),
									round.loopLabel ??
										fmt(t.rounds.holes, { n: round.holeCount }),
								].join(" · ")}
								actions={[
									{
										key: "delete",
										label: t.common.delete,
										systemImage: "trash",
										destructive: true,
										onPress: () => void deleteRound(round._id),
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
