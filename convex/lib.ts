import type { QueryCtx } from "./_generated/server";

/**
 * Owner identity with a local-dev fallback: the anonymous local deployment
 * (dummy Clerk issuer) and `convex run` have no identity. Single-user app —
 * tighten to a hard throw when real Clerk auth is wired end-to-end.
 */
export async function getUserId(ctx: QueryCtx): Promise<string> {
	const identity = await ctx.auth.getUserIdentity();
	return identity?.subject ?? "local-dev";
}
