import type { QueryCtx } from "./_generated/server";

/** Signed-in Clerk user id. Every per-user function goes through this, so an
 *  unauthenticated call fails instead of reading a shared fallback account.
 *  Seed per-user demo data with
 *  `pnpm exec convex run seed:seedDummyData --identity '{"subject":"user_…"}'`. */
export async function getUserId(ctx: QueryCtx): Promise<string> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Not signed in.");
	return identity.subject;
}
