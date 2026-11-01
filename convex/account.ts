import { mutation } from "./_generated/server";
import { deleteCourseData } from "./courses";
import { getUserId } from "./lib";
import { deleteRoundData } from "./rounds";

/**
 * Delete everything this app stores for the signed-in user (rounds, scores,
 * shots, clubs, settings, course copies, course suggestions). The client
 * deletes the Clerk user afterwards; run this first, while the session can
 * still authenticate. Catalog courses are shared and stay.
 */
export const deleteMyData = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const [rounds, clubs, settings, copies, suggestions] = await Promise.all([
			ctx.db
				.query("rounds")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.collect(),
			ctx.db
				.query("clubs")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.collect(),
			ctx.db
				.query("userSettings")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.collect(),
			ctx.db
				.query("courses")
				.withIndex("by_owner", (q) => q.eq("ownerId", userId))
				.collect(),
			ctx.db
				.query("courseSuggestions")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.collect(),
		]);
		for (const round of rounds) await deleteRoundData(ctx, round._id);
		await Promise.all(
			[...clubs, ...settings, ...suggestions].map((doc) =>
				ctx.db.delete(doc._id),
			),
		);
		for (const copy of copies) await deleteCourseData(ctx, copy._id);
	},
});
