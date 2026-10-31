import { api } from "./_generated/api";
import { action } from "./_generated/server";

/**
 * Single entry point for PR-preview seeding (`convex deploy --preview-run`
 * only accepts one function name). Seeds the shared course data only:
 * per-user demo rounds need a signed-in identity, which a deploy hook does
 * not have — run `seed:seedDummyData --identity …` for a specific user.
 * Safe to re-run on every push (already-seeded courses are skipped).
 *
 * Wired into .github/workflows/preview.yml as `--preview-run seedPreview:seedPreview`.
 */
export const seedPreview = action({
	args: {},
	handler: async (
		ctx,
	): Promise<{
		data: { course: string; holes: number; skipped: boolean }[];
	}> => {
		const data = await ctx.runAction(api.seed.seedData, {});
		return { data };
	},
});
