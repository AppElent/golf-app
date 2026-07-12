import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";

const HOME_COURSES = [
	{ name: "Golfbaan Landgoed Welderen", city: "Elst", osmRelationId: 901850 },
	{
		name: "De Oosterhoutse Golf Club",
		city: "Oosterhout",
		osmRelationId: 4458605,
	},
];

/**
 * Seed both home courses: create the course row, import geometry from OSM, and
 * add one editable default tee (neutral slope 113 so course handicap == index
 * until real ratings are entered in the editor). Idempotent by `osmRelationId`
 * — safe to re-run on every PR-preview redeploy without creating duplicates.
 *
 * Run with: pnpm exec convex run seed:seedData
 */
export const seedData = action({
	args: {},
	handler: async (
		ctx,
	): Promise<{ course: string; holes: number; skipped: boolean }[]> => {
		const existing = await ctx.runQuery(api.courses.list, {});
		const results: { course: string; holes: number; skipped: boolean }[] = [];
		for (const c of HOME_COURSES) {
			if (existing.some((e) => e.osmRelationId === c.osmRelationId)) {
				results.push({ course: c.name, holes: 0, skipped: true });
				continue;
			}
			const courseId = await ctx.runMutation(api.courses.create, {
				name: c.name,
				city: c.city,
				osmRelationId: c.osmRelationId,
			});
			const { holes } = await ctx.runAction(api.courses.importFromOsm, {
				courseId,
				osmRelationId: c.osmRelationId,
			});
			await ctx.runMutation(api.courses.upsertTee, {
				courseId,
				name: "Default (edit me)",
				courseRating: 72,
				slopeRating: 113,
			});
			results.push({ course: c.name, holes, skipped: false });
		}
		return results;
	},
});

// ─── Dummy round data (demo content for PR previews / empty dev backends) ────

const DUMMY_HANDICAP_INDEX = 18.4;
const DUMMY_CLUBS = [
	{ name: "Driver", carryMeters: 230 },
	{ name: "7i", carryMeters: 150 },
	{ name: "PW", carryMeters: 120 },
	{ name: "SW", carryMeters: 90 },
];

// Per-hole strokes-over-par deltas, one array per demo round (18 entries each,
// cycled if a loop is shorter). Varied so the would-be-index trend + last-round
// card show something other than identical numbers.
const OFFSET_PATTERNS: number[][] = [
	[1, 2, 0, 1, 1, -1, 1, 2, 1, 0, 1, 2, 1, 0, 1, -1, 0, 2],
	[2, 3, 1, 2, 2, 0, 2, 1, 2, 1, 1, 1, 2, 1, 0, 1, 1, 1],
	[0, 2, -1, 1, 0, -1, 1, 1, 0, 0, 0, 1, 1, -1, 0, 0, -1, 1],
];
const PUTTS_PATTERN = [2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 1];
const FIR_PATTERN = [
	true,
	false,
	true,
	true,
	false,
	true,
	true,
	false,
	true,
	true,
	true,
	false,
	true,
	true,
	false,
	true,
	true,
	true,
];
const GIR_PATTERN = [
	true,
	false,
	false,
	true,
	false,
	true,
	false,
	false,
	true,
	true,
	false,
	true,
	false,
	true,
	false,
	true,
	false,
	true,
];

interface CourseHoles {
	courseId: Id<"courses">;
	teeId: Id<"tees">;
	holeRefs: string[];
	pars: number[];
}

const DEFAULT_PAR = 4;

/**
 * Fill any hole missing par/stroke-index so the dummy round doesn't depend on
 * live OSM tag completeness — that's a real editor-completion concern for
 * actual imports (spec §8), but this seed exists to always produce a
 * demo-able round regardless of what the live Overpass data looks like on
 * any given preview redeploy.
 */
async function ensureCompleteHoles(
	ctx: ActionCtx,
	holes: ReadonlyArray<{
		_id: Id<"holes">;
		par?: number;
		strokeIndex?: number;
	}>,
): Promise<void> {
	const usedStrokeIndexes = new Set(
		holes
			.map((h) => h.strokeIndex)
			.filter((si): si is number => si !== undefined),
	);
	let candidate = 1;
	const nextFreeStrokeIndex = (): number => {
		while (usedStrokeIndexes.has(candidate)) candidate++;
		usedStrokeIndexes.add(candidate);
		return candidate;
	};
	for (const h of holes) {
		if (h.par !== undefined && h.strokeIndex !== undefined) continue;
		await ctx.runMutation(api.courses.upsertHole, {
			holeId: h._id,
			par: h.par ?? DEFAULT_PAR,
			strokeIndex: h.strokeIndex ?? nextFreeStrokeIndex(),
		});
	}
}

async function loadCourseHoles(
	ctx: ActionCtx,
	courseName: string,
): Promise<CourseHoles> {
	const courses = await ctx.runQuery(api.courses.list, {});
	const course = courses.find((c) => c.name === courseName);
	if (!course) {
		throw new Error(`Course "${courseName}" not found — run seed:seedData first.`);
	}
	const detail = await ctx.runQuery(api.courses.get, { courseId: course._id });
	if (!detail || detail.tees.length === 0) {
		throw new Error(`Course "${courseName}" has no tee — run seed:seedData first.`);
	}
	const holeRefs = detail.holes.map((h) => h.ref);
	if (holeRefs.some((r) => r === undefined) || holeRefs.length === 0) {
		throw new Error(`Course "${courseName}" is missing hole refs.`);
	}
	await ensureCompleteHoles(ctx, detail.holes);
	return {
		courseId: course._id,
		teeId: detail.tees[0]._id,
		holeRefs: holeRefs as string[],
		pars: detail.holes.map((h) => h.par ?? DEFAULT_PAR),
	};
}

async function seedFinishedRound(
	ctx: ActionCtx,
	course: CourseHoles,
	offsets: number[],
): Promise<void> {
	const roundId = await ctx.runMutation(api.rounds.start, {
		courseId: course.courseId,
		teeId: course.teeId,
		holeRefs: course.holeRefs,
		format: "stableford",
		players: [{ name: "Eric", handicapIndex: DUMMY_HANDICAP_INDEX }],
	});
	for (let i = 0; i < course.holeRefs.length; i++) {
		const par = course.pars[i];
		const strokes = Math.max(1, par + offsets[i % offsets.length]);
		await ctx.runMutation(api.rounds.setScore, {
			roundId,
			holeIndex: i,
			playerIndex: 0,
			strokes,
			putts: PUTTS_PATTERN[i % PUTTS_PATTERN.length],
			fir: par > 3 ? FIR_PATTERN[i % FIR_PATTERN.length] : undefined,
			gir: GIR_PATTERN[i % GIR_PATTERN.length],
		});
	}
	await ctx.runMutation(api.rounds.finish, { roundId });
}

async function seedActiveRound(
	ctx: ActionCtx,
	course: CourseHoles,
): Promise<void> {
	const roundId = await ctx.runMutation(api.rounds.start, {
		courseId: course.courseId,
		teeId: course.teeId,
		holeRefs: course.holeRefs,
		format: "stableford",
		players: [{ name: "Eric", handicapIndex: DUMMY_HANDICAP_INDEX }],
	});
	const holesPlayed = 4;
	for (let i = 0; i < holesPlayed; i++) {
		const par = course.pars[i];
		await ctx.runMutation(api.rounds.setScore, {
			roundId,
			holeIndex: i,
			playerIndex: 0,
			strokes: par + OFFSET_PATTERNS[0][i % OFFSET_PATTERNS[0].length],
			putts: PUTTS_PATTERN[i % PUTTS_PATTERN.length],
			fir: par > 3 ? FIR_PATTERN[i % FIR_PATTERN.length] : undefined,
			gir: GIR_PATTERN[i % GIR_PATTERN.length],
		});
	}
	await ctx.runMutation(api.rounds.setCurrentHole, { roundId, holeIndex: holesPlayed });
}

/**
 * Demo content so an empty backend (fresh PR preview, or `local-dev`
 * anonymous dev deployment) isn't blank on first load: a handicap + club bag,
 * three finished rounds (so Home/Progress show a trend and stats), and one
 * active in-progress round on holes 1–4 (so Play/Card have something to show).
 * Requires `seedData` to have already run. Idempotent — skips entirely if any
 * round already exists for the seeding user, so re-running on every PR-preview
 * redeploy is a safe no-op after the first run.
 *
 * Run with: pnpm exec convex run seed:seedDummyData
 */
export const seedDummyData = action({
	args: {},
	handler: async (ctx): Promise<{ skipped: boolean }> => {
		const [active, history] = await Promise.all([
			ctx.runQuery(api.rounds.active, {}),
			ctx.runQuery(api.rounds.history, { limit: 1 }),
		]);
		if (active !== null || history.length > 0) {
			return { skipped: true };
		}

		await ctx.runMutation(api.settings.update, {
			handicapIndex: DUMMY_HANDICAP_INDEX,
			units: "m",
		});
		const existingClubs = await ctx.runQuery(api.clubs.list, {});
		for (const club of DUMMY_CLUBS) {
			if (existingClubs.some((c) => c.name === club.name)) continue;
			await ctx.runMutation(api.clubs.create, club);
		}

		const course = await loadCourseHoles(ctx, "De Oosterhoutse Golf Club");
		for (const offsets of OFFSET_PATTERNS) {
			await seedFinishedRound(ctx, course, offsets);
		}
		await seedActiveRound(ctx, course);

		return { skipped: false };
	},
});
