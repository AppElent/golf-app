import { query } from "./_generated/server";
import { getUserId } from "./lib";

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const clubs = await ctx.db
			.query("clubs")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		return clubs.sort((a, b) => a.sortOrder - b.sortOrder);
	},
});
