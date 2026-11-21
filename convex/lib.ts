import type { QueryCtx } from "./_generated/server";

/** Signed-in Clerk user id, or `null` without a session. For read queries a
 *  live screen subscribes to: Convex re-runs them without an identity when
 *  the Clerk token lapses, and they answer empty instead of throwing. */
export async function getOptionalUserId(ctx: QueryCtx): Promise<string | null> {
	return (await ctx.auth.getUserIdentity())?.subject ?? null;
}

/** Signed-in Clerk user id. Every mutation goes through this, so an
 *  unauthenticated call fails instead of reading a shared fallback account.
 *  Seed per-user demo data with
 *  `pnpm exec convex run seed:seedDummyData --identity '{"subject":"user_…"}'`. */
export async function getUserId(ctx: QueryCtx): Promise<string> {
	const userId = await getOptionalUserId(ctx);
	if (!userId) throw new Error("Not signed in.");
	return userId;
}
