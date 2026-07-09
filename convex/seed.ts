import { api } from "./_generated/api";
import { action } from "./_generated/server";

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
 * until real ratings are entered in the editor). Creates a new course each run,
 * so run once on a fresh deployment.
 *
 * Run with: pnpm exec convex run seed:seed
 */
export const seed = action({
	args: {},
	handler: async (ctx): Promise<{ course: string; holes: number }[]> => {
		const results: { course: string; holes: number }[] = [];
		for (const c of HOME_COURSES) {
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
			results.push({ course: c.name, holes });
		}
		return results;
	},
});
