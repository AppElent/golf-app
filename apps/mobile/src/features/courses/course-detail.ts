import type { api } from "../../convex/api";
import type { useQuery } from "../../convex/query-cache";

export type CourseDetail = NonNullable<
	ReturnType<typeof useQuery<typeof api.courses.get>>
>;
