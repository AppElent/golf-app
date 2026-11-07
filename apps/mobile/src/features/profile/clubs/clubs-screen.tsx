import { formatDistance } from "@fairway/core/format";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { api, type Doc, type Id } from "../../../convex/api";
import { convexErrorMessage } from "../../../convex/error-message";
import { useQuery } from "../../../convex/query-cache";
import { fmt, useI18n } from "../../../i18n";
import { metrics, spacing } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { EmptyState } from "../../../ui/empty-state";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { NavHeader } from "../../../ui/nav-header";
import { SkeletonList } from "../../../ui/skeleton";
import { useToast } from "../../../ui/toast";
import { useUnits } from "../use-units";

export function ClubsScreen() {
	const { t } = useI18n();
	const router = useRouter();
	const confirm = useConfirm();
	const toast = useToast();
	const clubs = useQuery(api.clubs.list);
	const remove = useMutation(api.clubs.remove);
	const reorder = useMutation(api.clubs.reorder);
	const units = useUnits();
	const add = () => router.push("/profile/club");
	const header = (
		<NavHeader
			title={t.clubs.title}
			right={{ label: t.clubs.add, onPress: add }}
		/>
	);

	if (clubs === undefined) {
		return (
			<>
				{header}
				<SkeletonList rows={4} />
			</>
		);
	}
	if (clubs.length === 0) {
		return (
			<>
				{header}
				<EmptyState
					title={t.clubs.empty}
					body={t.clubs.emptyHint}
					action={{ label: t.clubs.add, onPress: add }}
				/>
			</>
		);
	}

	async function run(action: () => Promise<unknown>) {
		try {
			await action();
		} catch (e) {
			toast.error(convexErrorMessage(e, t.clubs.saveError));
		}
	}

	function move(list: Doc<"clubs">[], from: number, to: number) {
		const ids: Id<"clubs">[] = list.map((c) => c._id);
		const [id] = ids.splice(from, 1);
		ids.splice(to, 0, id);
		void run(() => reorder({ orderedIds: ids }));
	}

	async function onDelete(club: Doc<"clubs">) {
		const ok = await confirm({
			title: fmt(t.clubs.deleteTitle, { name: club.name }),
			confirmLabel: t.clubs.delete,
			destructive: true,
		});
		if (ok) await run(() => remove({ clubId: club._id }));
	}

	return (
		<>
			{header}
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={styles.content}
			>
				<InsetList footer={t.clubs.emptyHint}>
					{clubs.map((club, i) => (
						<InsetRow
							key={club._id}
							title={club.name}
							value={formatDistance(club.carryMeters, units)}
							chevron
							onPress={() =>
								router.push({
									pathname: "/profile/club",
									params: { clubId: club._id },
								})
							}
							actions={[
								...(i > 0
									? [
											{
												key: "up",
												label: t.clubs.moveUp,
												systemImage: "arrow.up" as const,
												swipe: false,
												onPress: () => move(clubs, i, i - 1),
											},
										]
									: []),
								...(i < clubs.length - 1
									? [
											{
												key: "down",
												label: t.clubs.moveDown,
												systemImage: "arrow.down" as const,
												swipe: false,
												dividerAfter: true,
												onPress: () => move(clubs, i, i + 1),
											},
										]
									: []),
								{
									key: "delete",
									label: t.clubs.delete,
									systemImage: "trash",
									destructive: true,
									onPress: () => void onDelete(club),
								},
							]}
						/>
					))}
				</InsetList>
			</ScrollView>
		</>
	);
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: metrics.screenGutter,
		paddingTop: spacing.md,
		paddingBottom: spacing.xxl,
	},
});
