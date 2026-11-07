import { type LatLng, sortByDistance } from "@fairway/core/geo";

interface PickerCourse {
	_id: string;
	name: string;
	city?: string;
	location?: LatLng;
}

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
