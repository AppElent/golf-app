/**
 * What the session gate's offline fallback may draw (APP-146): the saved copy
 * of the active round and its course for the account Clerk restored locally,
 * but only when Convex last confirmed that same account on this phone
 * (`convex/last-known.ts`). Display only.
 *
 * The copy's key (bundle, account, function, arguments) is what makes it the
 * right shape; this only drops a copy that could not be drawn at all, so a
 * damaged one reads as a missing one instead of throwing in render.
 */
import type { Club } from "@fairway/core/club-suggest";
import { DEFAULT_UNITS, type Units } from "@fairway/core/format";
import type { Value } from "convex/values";
import { readOfflineEntry } from "../../../convex/last-known";
import { isOfflineReadable } from "../../../convex/persisted";
import type { CourseDetail } from "../../courses/course-detail";
import type { ActiveRound } from "../../rounds/use-active-round";

export interface OfflineRound {
	account: string;
	active: ActiveRound;
	detail: CourseDetail;
	units: Units;
	clubs: ReadonlyArray<Club>;
}

function read(account: string, name: string, args: Value) {
	return isOfflineReadable(name)
		? readOfflineEntry(account, name, args)
		: undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

function isActiveRound(value: unknown): value is ActiveRound {
	if (!isRecord(value)) return false;
	const { round, course, tee, holes, scores } = value;
	return (
		isRecord(round) &&
		typeof round._id === "string" &&
		typeof round.courseId === "string" &&
		Array.isArray(round.holeRefs) &&
		typeof round.currentHoleIndex === "number" &&
		Number.isInteger(round.currentHoleIndex) &&
		round.currentHoleIndex >= 0 &&
		round.currentHoleIndex < round.holeRefs.length &&
		isRecord(course) &&
		typeof course.name === "string" &&
		isRecord(tee) &&
		Array.isArray(holes) &&
		Array.isArray(scores) &&
		round.simulated !== true
	);
}

function isCourseDetail(value: unknown): value is CourseDetail {
	return (
		isRecord(value) &&
		isRecord(value.course) &&
		Array.isArray(value.holes) &&
		Array.isArray(value.geometry)
	);
}

/** The round to draw offline, or null: show nothing and wait for Convex. */
export function offlineRound(
	account: string | null | undefined,
): OfflineRound | null {
	if (!account) return null;
	try {
		const active = read(account, "rounds:active", {});
		if (!isActiveRound(active)) return null;
		const detail = read(account, "courses:get", {
			courseId: active.round.courseId,
		});
		if (!isCourseDetail(detail)) return null;
		const settings = read(account, "settings:get", {});
		const units =
			isRecord(settings) && (settings.units === "m" || settings.units === "yd")
				? settings.units
				: DEFAULT_UNITS;
		const clubs = read(account, "clubs:list", {});
		return {
			account,
			active,
			detail,
			units,
			clubs: Array.isArray(clubs) ? (clubs as unknown as Club[]) : [],
		};
	} catch {
		return null;
	}
}
