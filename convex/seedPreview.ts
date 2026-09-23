import { api } from "./_generated/api";
import { action } from "./_generated/server";

/**
 * Single entry point for PR-preview seeding. `convex deploy --preview-run`
 * only accepts one function name, so this composes the two idempotent seed
 * actions in order — course data must exist before dummy rounds can be
 * scored against it. Safe to re-run on every push (both steps skip already-
 * seeded data).
 *
 * Wired into .github/workflows/preview.yml as `--preview-run seedPreview:seedPreview`.
 */
export const seedPreview = action({
	args: {},
	handler: async (
		ctx,
	): Promise<{
		data: { course: string; holes: number; skipped: boolean }[];
		dummy: { skipped: boolean };
	}> => {
		const data = await ctx.runAction(api.seed.seedData, {});
		const dummy = await ctx.runAction(api.seed.seedDummyData, {});
		return { data, dummy };
	},
});
