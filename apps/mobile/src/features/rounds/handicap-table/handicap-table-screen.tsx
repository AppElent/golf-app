/**
 * Which holes each player gets strokes on: of the round being set up (its
 * `setup` parameter), else of the round being played.
 */
import { handicapTable } from "@fairway/core/handicap-table";
import { Stack, useRouter } from "expo-router";
import { type ReactNode, useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { fmt, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { EmptyState } from "../../../ui/empty-state";
import { FormScreen } from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { NoActiveRound } from "../components/no-active-round";
import { useDisplayedActiveRound } from "../use-active-round";
import { HandicapTableGrid } from "./handicap-table-grid";
import { type TableRound, tablePlayers } from "./handicap-table-model";
import type { HandicapTableSetup } from "./handicap-table-params";

interface TableProps {
	tee: { name: string; courseRating: number; slopeRating: number };
	holes: readonly { ref: string; par?: number; strokeIndex?: number }[];
	round: TableRound;
	currentHole?: number;
}

export function HandicapTableScreen({
	setup,
	hole,
}: {
	setup: HandicapTableSetup | null;
	/** The hole on screen in Play, which may be ahead of the server's. */
	hole?: string;
}) {
	return setup ? <SetupTable setup={setup} /> : <RoundTable hole={hole} />;
}

function SetupTable({ setup }: { setup: HandicapTableSetup }) {
	const { t } = useI18n();
	const detail = useQuery(api.courses.get, { courseId: setup.courseId });
	if (detail === undefined) return <LoadingTable />;
	const tee = detail?.tees.find((x) => x._id === setup.teeId);
	if (!detail || !tee) {
		return (
			<TableFrame>
				<EmptyState body={t.setup.notFound} />
			</TableFrame>
		);
	}
	const byRef = new Map(detail.holes.map((h) => [h.ref, h]));
	return (
		<Table
			tee={tee}
			holes={setup.holeRefs.map((ref) => ({
				ref,
				par: byRef.get(ref)?.par,
				strokeIndex: byRef.get(ref)?.strokeIndex,
			}))}
			round={setup}
		/>
	);
}

function RoundTable({ hole }: { hole?: string }) {
	const { t } = useI18n();
	const active = useDisplayedActiveRound();
	if (active === undefined) return <LoadingTable />;
	if (active === null) {
		return (
			<TableFrame>
				<NoActiveRound title={t.play.noRound} closeLabel={t.common.done} />
			</TableFrame>
		);
	}
	const { round, holes, tee } = active;
	const parsed = Number(hole);
	return (
		<Table
			tee={tee}
			holes={holes}
			round={round}
			currentHole={
				hole !== undefined && Number.isInteger(parsed) && parsed in holes
					? parsed
					: round.currentHoleIndex
			}
		/>
	);
}

function Table({ tee, holes, round, currentHole }: TableProps) {
	const { t, numbers } = useI18n();
	const players = tablePlayers(round, t.formats);
	const rows = handicapTable(holes, players);
	return (
		<TableFrame
			subtitle={fmt(t.handicapTable.subtitle, {
				tee: tee.name,
				count: holes.length,
			})}
		>
			{rows ? (
				<View style={styles.content}>
					<AppText variant="footnote" style={styles.inset}>
						{fmt(t.setup.teeDetail, {
							cr: numbers.decimal(tee.courseRating),
							slope: tee.slopeRating,
						})}
					</AppText>
					<HandicapTableGrid
						rows={rows}
						players={players}
						currentHole={currentHole}
					/>
					<AppText variant="footnote" style={styles.inset}>
						{t.handicapTable.footer}
					</AppText>
				</View>
			) : (
				<EmptyState body={t.handicapTable.noStrokeIndexes} />
			)}
		</TableFrame>
	);
}

function LoadingTable() {
	return (
		<TableFrame>
			<SkeletonList rows={9} leading={false} />
		</TableFrame>
	);
}

function TableFrame({
	subtitle,
	children,
}: {
	subtitle?: string;
	children: ReactNode;
}) {
	const { t } = useI18n();
	const router = useRouter();
	const colors = useTokens();
	const title = t.handicapTable.title;
	// Memoized: a new options object per render re-renders the header.
	const options = useMemo(
		() => ({
			// Opaque: on a small phone the rows scroll under the header.
			headerStyle: { backgroundColor: colors.bg },
			headerShadowVisible: false,
			headerTitle: () => (
				<View accessible accessibilityRole="header" style={styles.title}>
					<AppText variant="row" numberOfLines={1}>
						{title}
					</AppText>
					{subtitle ? (
						<AppText variant="caption" numberOfLines={1}>
							{subtitle}
						</AppText>
					) : null}
				</View>
			),
		}),
		[title, subtitle, colors],
	);
	return (
		<>
			<NavHeader
				title={title}
				right={{ label: t.common.done, onPress: () => router.back() }}
			/>
			<Stack.Screen options={options} />
			<FormScreen nativeSheet={Platform.OS === "ios"} avoidKeyboard={false}>
				{children}
			</FormScreen>
		</>
	);
}

const styles = StyleSheet.create({
	content: { gap: spacing.sm },
	inset: { paddingHorizontal: spacing.xs },
	title: { alignItems: Platform.OS === "ios" ? "center" : "flex-start" },
});
