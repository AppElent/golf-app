/** Pick the home course (or none). Saves on tap and goes back. */
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useI18n } from "../../../i18n";
import { convexErrorMessage } from "../../../ui/confirm-dialog";
import { FormChoiceRow, FormScreen, FormSection } from "../../../ui/form";
import { ScreenHeader } from "../../../ui/screen-header";
import { SkeletonList } from "../../../ui/skeleton";
import { useToast } from "../../../ui/toast";

export function HomeCourseScreen() {
	const { t } = useI18n();
	const router = useRouter();
	const toast = useToast();
	const settings = useQuery(api.settings.get);
	const courses = useQuery(api.courses.list);
	const update = useMutation(api.settings.update);

	async function choose(homeCourseId: Id<"courses"> | null) {
		try {
			await update({ homeCourseId });
			router.back();
		} catch (e) {
			toast.error(convexErrorMessage(e, t.profile.saveError));
		}
	}

	return (
		<>
			<ScreenHeader title={t.profile.homeCourse} />
			{settings === undefined || courses === undefined ? (
				<SkeletonList rows={3} />
			) : (
				<FormScreen>
					<FormSection>
						<FormChoiceRow
							role="radio"
							label={t.profile.homeCourseNone}
							selected={settings.homeCourseId === null}
							onPress={() => void choose(null)}
						/>
						{courses.map((course) => (
							<FormChoiceRow
								key={course._id}
								role="radio"
								label={course.name}
								selected={settings.homeCourseId === course._id}
								onPress={() => void choose(course._id)}
							/>
						))}
					</FormSection>
				</FormScreen>
			)}
		</>
	);
}
