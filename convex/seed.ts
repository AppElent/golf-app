import { detectLoops } from "@fairway/core/loops";
import { hasFairway, OWNER_INDEX } from "@fairway/core/round";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction } from "./_generated/server";

// ─── Dummy round data (demo content for PR previews / empty dev backends) ────

const DUMMY_HANDICAP_INDEX = 18.4;
const DUMMY_TEE = "Geel · heren";
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

async function loadCourseHoles(
	ctx: ActionCtx,
	catalogKey: string,
): Promise<CourseHoles> {
	const courses = await ctx.runQuery(api.courses.list, {});
	const course = courses.find((c) => c.catalogKey === catalogKey);
	if (!course) {
		throw new Error(
			`Catalog course "${catalogKey}" not found — run courseCatalog:sync first.`,
		);
	}
	const detail = await ctx.runQuery(api.courses.get, { courseId: course._id });
	const tee = detail?.tees.find((t) => t.name === DUMMY_TEE) ?? detail?.tees[0];
	if (!detail || !tee) {
		throw new Error(`Course "${catalogKey}" has no tee — fix the catalog.`);
	}

	const loops = detectLoops(detail.holes);
	if (loops.length < 2) {
		throw new Error(
			`Course "${catalogKey}" doesn't have a front+back 18-hole combination.`,
		);
	}
	const holeRefs = [...loops[0].refs, ...loops[1].refs];

	const parByRef = new Map(detail.holes.map((h) => [h.ref, h.par]));
	return {
		courseId: course._id,
		teeId: tee._id,
		holeRefs,
		pars: holeRefs.map((ref) => {
			const par = parByRef.get(ref);
			if (par === undefined) {
				throw new Error(
					`Course "${catalogKey}" hole ${ref} has no par — fix the catalog.`,
				);
			}
			return par;
		}),
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
		players: [{ name: "You", handicapIndex: DUMMY_HANDICAP_INDEX }],
	});
	for (let i = 0; i < course.holeRefs.length; i++) {
		const par = course.pars[i];
		const strokes = Math.max(1, par + offsets[i % offsets.length]);
		await ctx.runMutation(api.rounds.setScore, {
			roundId,
			holeIndex: i,
			playerIndex: OWNER_INDEX,
			strokes,
			putts: PUTTS_PATTERN[i % PUTTS_PATTERN.length],
			fir: hasFairway(par) ? FIR_PATTERN[i % FIR_PATTERN.length] : undefined,
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
		players: [{ name: "You", handicapIndex: DUMMY_HANDICAP_INDEX }],
	});
	const holesPlayed = 4;
	for (let i = 0; i < holesPlayed; i++) {
		const par = course.pars[i];
		await ctx.runMutation(api.rounds.setScore, {
			roundId,
			holeIndex: i,
			playerIndex: OWNER_INDEX,
			strokes: par + OFFSET_PATTERNS[0][i % OFFSET_PATTERNS[0].length],
			putts: PUTTS_PATTERN[i % PUTTS_PATTERN.length],
			fir: hasFairway(par) ? FIR_PATTERN[i % FIR_PATTERN.length] : undefined,
			gir: GIR_PATTERN[i % GIR_PATTERN.length],
		});
	}
	await ctx.runMutation(api.rounds.setCurrentHole, {
		roundId,
		holeIndex: holesPlayed,
	});
}

/**
 * Demo content for one signed-in user so an empty account isn't blank: a handicap + club bag,
 * three finished rounds (so Home/Progress show a trend and stats), and one
 * active in-progress round on holes 1–4 (so Play/Card have something to show).
 * Requires the course catalog to be synced. Idempotent — skips entirely if any
 * round already exists for the seeding user.
 *
 * Run with: pnpm exec convex run seed:seedDummyData --identity '{"subject":"user_…"}'
 */
export const seedDummyData = internalAction({
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

		const course = await loadCourseHoles(ctx, "oosterhoutse");
		for (const offsets of OFFSET_PATTERNS) {
			await seedFinishedRound(ctx, course, offsets);
		}
		await seedActiveRound(ctx, course);

		return { skipped: false };
	},
});
