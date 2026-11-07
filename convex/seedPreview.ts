import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/**
 * Single entry point for PR-preview seeding (`convex deploy --preview-run`
 * only accepts one function name). Syncs the course catalog only — from
 * committed data, no network calls:
 * per-user demo rounds need a signed-in identity, which a deploy hook does
 * not have — run `seed:seedDummyData --identity …` for a specific user.
 * Safe to re-run on every push (the sync is idempotent).
 *
 * Wired into .github/workflows/preview.yml as `--preview-run seedPreview:seedPreview`.
 */
export const seedPreview = internalAction({
	args: {},
	handler: async (ctx): Promise<{ key: string; created: boolean }[]> => {
		const results = await ctx.runMutation(internal.courseCatalog.sync, {});
		return results.map(({ key, created }) => ({ key, created }));
	},
});
