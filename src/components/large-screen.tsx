import { FEATURES, type Feature } from "@fairway/core/features";
import { useRouterState } from "@tanstack/react-router";
import { Monitor } from "lucide-react";
import { SURFACE } from "./classes";

/**
 * Web route files (relative to `src/routes`, without extension) owned by a
 * feature that `features.ts` declares `layout: "large-screen"`. Those routes
 * leave the 430px phone shell and use the window's width.
 */
export const LARGE_SCREEN_ROUTE_FILES: ReadonlySet<string> = new Set(
	(FEATURES as readonly Feature[]).flatMap((feature) =>
		feature.layout === "large-screen" ? (feature.routes.web ?? []) : [],
	),
);

/**
 * The flat route file a TanStack route id comes from:
 * `/courses/` → `courses.index`, `/courses/$courseId/edit` → `courses.$courseId.edit`.
 */
export function routeFileOf(routeId: string): string {
	const path = routeId.replace(/^\//, "");
	const file = path === "" || path.endsWith("/") ? `${path}index` : path;
	return file.replaceAll("/", ".");
}

export function isLargeScreenRoute(routeId: string): boolean {
	return LARGE_SCREEN_ROUTE_FILES.has(routeFileOf(routeId));
}

/** Whether the current page belongs to a large-screen feature. */
export function useLargeScreenRoute(): boolean {
	return useRouterState({
		select: (state) =>
			state.matches.some((match) => isLargeScreenRoute(match.routeId)),
	});
}

/**
 * Shown below the `md` breakpoint on large-screen pages, per the
 * platform-parity standard: the page still works, it just says where it works
 * best.
 */
export function LargeScreenNotice() {
	return (
		<p
			role="note"
			className={`mb-6 flex items-start gap-2.5 rounded-2xl border ${SURFACE} px-4 py-3 text-label text-moss md:hidden`}
		>
			<Monitor aria-hidden className="mt-0.5 size-4 shrink-0 text-pine-ink" />
			<span>
				<span className="font-semibold text-ink">Best on a larger screen.</span>{" "}
				Courses work here, but editing them is easier on a tablet or computer
				with a keyboard.
			</span>
		</p>
	);
}
