import { deleteRoundData } from "./rounds";
import { mutation } from "./_generated/server";
import { getUserId } from "./lib";

/**
 * Delete everything this app stores for the signed-in user (rounds, scores,
 * shots, clubs, settings). The client deletes the Clerk user afterwards; run
 * this first, while the session can still authenticate. Shared course data is
 * not per-user and stays.
 */
export const deleteMyData = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const [rounds, clubs, settings] = await Promise.all([
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
		]);
		for (const round of rounds) await deleteRoundData(ctx, round._id);
		await Promise.all(
			[...clubs, ...settings].map((doc) => ctx.db.delete(doc._id)),
		);
	},
});
