import { formatTravelDistance } from "@fairway/core/format";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { fmt, useI18n } from "../../../i18n";
import { metrics, spacing } from "../../../theme";
import { GhostButton } from "../../../ui/button";
import { EmptyState } from "../../../ui/empty-state";
import { FormSearchField } from "../../../ui/form";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { useCurrentPosition } from "../../location/position/use-current-position";
import { useUnits } from "../../profile/use-units";
import { pickerCourses } from "./course-picker-model";

export function CoursePickerScreen() {
	const router = useRouter();
	const { t } = useI18n();
	const courses = useQuery(api.courses.list);
	const settings = useQuery(api.settings.get);
	const { state, request } = useCurrentPosition();
	const [query, setQuery] = useState("");

	const position = state.status === "ready" ? state.position : null;
	const units = useUnits();
	const homeCourseId = settings?.homeCourseId ?? null;
	const rows = courses
		? pickerCourses(courses, { query, position, homeCourseId })
		: undefined;

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
			contentContainerStyle={styles.content}
		>
			<Stack.Screen options={{ title: t.courses.title }} />
			<FormSearchField
				label={t.courses.search}
				value={query}
				onChangeText={setQuery}
			/>

			{state.status === "unknown" ||
			state.status === "denied" ||
			state.status === "unavailable" ? (
				<View style={styles.locationPrompt}>
					<AppText variant="footnote" style={styles.flex}>
						{state.status === "unavailable"
							? t.courses.locationUnavailable
							: t.courses.locationOff}
					</AppText>
					{state.status === "denied" ? null : (
						<GhostButton
							label={
								state.status === "unknown"
									? t.courses.allowLocation
									: t.common.retry
							}
							onPress={request}
						/>
					)}
				</View>
			) : state.status === "locating" && !position ? (
				<AppText variant="footnote">{t.courses.locating}</AppText>
			) : null}

			{rows === undefined ? (
				<SkeletonList rows={4} />
			) : courses?.length === 0 ? (
				<EmptyState title={t.courses.empty} body={t.courses.emptyHint} />
			) : rows.length === 0 ? (
				<EmptyState
					appearance="search"
					body={fmt(t.courses.noMatch, { query })}
				/>
			) : (
				<InsetList header={position ? t.courses.nearby : t.courses.all}>
					{rows.map((course) => (
						<InsetRow
							key={course._id}
							leading={{
								symbol:
									course._id === homeCourseId ? "house.fill" : "flag.fill",
							}}
							title={course.name}
							secondary={[
								course._id === homeCourseId ? t.courses.home : null,
								course.ownerId ? t.setup.myCopy : null,
								course.city,
							]
								.filter(Boolean)
								.join(" · ")}
							value={
								course.distanceMeters === null
									? undefined
									: formatTravelDistance(course.distanceMeters, units)
							}
							chevron
							onPress={() => router.push(`/setup/${course._id}`)}
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
	locationPrompt: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	flex: { flex: 1 },
});
