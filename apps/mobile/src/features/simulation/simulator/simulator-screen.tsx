import { Stack, useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useI18n } from "../../../i18n";
import { metrics, spacing } from "../../../theme";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { useSimulationMode } from "../mode/use-simulation-mode";

/** Entry to simulation mode: pick up the last run, or start one on a course. */
export function SimulatorScreen() {
	const router = useRouter();
	const { t } = useI18n();
	const { setSimulating } = useSimulationMode();
	const running = useQuery(api.rounds.activeSimulation);
	const courses = useQuery(api.courses.list);

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			<Stack.Screen options={{ title: t.simulator.title }} />
			<AppText variant="footnote">{t.simulator.intro}</AppText>
			{running ? (
				<InsetList header={t.simulator.running}>
					<InsetRow
						leading={{ symbol: "play.circle" }}
						title={running.course.name}
						value={t.simulator.resume}
						chevron
						onPress={() => {
							setSimulating(true);
							router.push("/play");
						}}
					/>
				</InsetList>
			) : null}
			{courses === undefined ? (
				<SkeletonList rows={4} />
			) : (
				<InsetList header={t.simulator.pickCourse}>
					{courses.map((course) => (
						<InsetRow
							key={course._id}
							leading={{ symbol: "flag" }}
							title={course.name}
							chevron
							onPress={() =>
								router.push({
									pathname: "/setup/[courseId]",
									params: { courseId: course._id, simulate: "1" },
								})
							}
						/>
					))}
				</InsetList>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: metrics.screenGutter,
		paddingBottom: spacing.xxl,
		gap: spacing.md,
	},
});
