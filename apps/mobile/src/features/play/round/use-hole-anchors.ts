import { holeAnchors } from "@fairway/core/hole-view";
import { useMemo } from "react";
import type { CourseDetail } from "../../courses/course-detail";

export function useHoleAnchors(
	holeRefs: readonly string[],
	detail: CourseDetail | null,
	holeIndex: number,
	/** The hole played after this one, null on the last. */
	nextIndex: number | null,
	teeMarker: string | undefined,
) {
	const ref = holeRefs[holeIndex];
	const geometry = detail?.geometry.find((g) => g.ref === ref) ?? null;
	const anchors = useMemo(
		() => (geometry ? holeAnchors(geometry, teeMarker) : null),
		[geometry, teeMarker],
	);
	const nextRef = nextIndex === null ? undefined : holeRefs[nextIndex];
	const nextGeometry =
		nextRef === undefined
			? null
			: (detail?.geometry.find((g) => g.ref === nextRef) ?? null);
	const nextAnchors = useMemo(
		() => (nextGeometry ? holeAnchors(nextGeometry, teeMarker) : null),
		[nextGeometry, teeMarker],
	);
	return {
		geometry,
		anchors,
		nextAnchors,
		/** Changes when play moves to another hole: per-hole state resets on it. */
		holeKey: `${ref}|${anchors?.green.lat}|${anchors?.green.lng}`,
	};
}
