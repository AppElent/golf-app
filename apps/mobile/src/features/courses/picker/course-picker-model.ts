import { type LatLng, sortByDistance } from "@fairway/core/geo";

interface PickerCourse {
	_id: string;
	name: string;
	city?: string;
	location?: LatLng;
}

/** A course this close is the one you are at: it beats the home course. */
export const AT_COURSE_METERS = 2_000;

/**
 * Matching courses, nearest first with a fix. The course you are standing at
 * (within 2 km) leads; otherwise the home course is pinned on top.
 */
export function pickerCourses<C extends PickerCourse>(
	courses: readonly C[],
	{
		query,
		position,
		homeCourseId,
	}: { query: string; position: LatLng | null; homeCourseId: string | null },
): Array<C & { distanceMeters: number | null }> {
	const needle = normalize(query);
	const matching = courses.filter(
		(c) =>
			needle === "" ||
			normalize(c.name).includes(needle) ||
			normalize(c.city ?? "").includes(needle),
	);
	const ordered = position
		? sortByDistance(matching, position)
		: matching.map((c) => ({ ...c, distanceMeters: null }));
	const nearest = ordered[0]?.distanceMeters;
	if (nearest != null && nearest <= AT_COURSE_METERS) return ordered;
	const home = ordered.findIndex((c) => c._id === homeCourseId);
	if (home <= 0) return ordered;
	return [ordered[home], ...ordered.slice(0, home), ...ordered.slice(home + 1)];
}

const normalize = (s: string) =>
	s
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();
