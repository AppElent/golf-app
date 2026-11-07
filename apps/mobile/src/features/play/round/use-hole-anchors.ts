import { holeAnchors } from "@fairway/core/hole-view";
import { useMemo } from "react";
import type { CourseDetail } from "../../courses/course-detail";

export function useHoleAnchors(
	holeRefs: readonly string[],
	detail: CourseDetail | null,
	holeIndex: number,
) {
	const ref = holeRefs[holeIndex];
	const geometry = detail?.geometry.find((g) => g.ref === ref) ?? null;
	const anchors = useMemo(
		() => (geometry ? holeAnchors(geometry) : null),
		[geometry],
	);
	const nextRef = holeRefs[holeIndex + 1];
	const nextGeometry =
		nextRef === undefined
			? null
			: (detail?.geometry.find((g) => g.ref === nextRef) ?? null);
	const nextAnchors = useMemo(
		() => (nextGeometry ? holeAnchors(nextGeometry) : null),
		[nextGeometry],
	);
	return {
		geometry,
		anchors,
		nextAnchors,
		/** Changes when play moves to another hole: per-hole state resets on it. */
		holeKey: `${ref}|${anchors?.green.lat}|${anchors?.green.lng}`,
	};
}
