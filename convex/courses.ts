import { MAX_SUGGESTION_LENGTH } from "@fairway/core/course-suggestion";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { getUserId } from "./lib";
import { deleteRoundData } from "./rounds";

/**
 * Courses come from the catalog (convex/catalog, read-only, everyone sees
 * them) or are a user's own copy of one (`ownerId`, private, editable).
 * Corrections to the catalog go through `suggest`, not through edits.
 */

async function viewerId(ctx: QueryCtx): Promise<string | null> {
	return (await ctx.auth.getUserIdentity())?.subject ?? null;
}

/** The tables whose rows belong to one course: copied and deleted with it. */
const COURSE_CHILD_TABLES = ["tees", "holes", "holeGeometry"] as const;

/** Catalog courses are visible to all; a copy only to its owner. */
export function canSee(course: Doc<"courses">, userId: string | null) {
	return course.ownerId === undefined || course.ownerId === userId;
}

/** The course, if the signed-in user may edit it (their own copy). */
async function requireOwnCourse(
	ctx: QueryCtx,
	courseId: Id<"courses">,
): Promise<Doc<"courses">> {
	const userId = await getUserId(ctx);
	const course = await ctx.db.get(courseId);
	if (!course) throw new Error("Course not found.");
	if (course.ownerId === undefined) {
		throw new Error(
			"Catalog courses are read-only. Make your own copy, or suggest a correction.",
		);
	}
	if (course.ownerId !== userId) throw new Error("Course not found.");
	return course;
}

/** Every round played on the course (rounds reach a course through its tees). */
export async function roundsOnCourse(
	ctx: QueryCtx,
	courseId: Id<"courses">,
): Promise<Doc<"rounds">[]> {
	const tees = await ctx.db
		.query("tees")
		.withIndex("by_course", (q) => q.eq("courseId", courseId))
		.collect();
	const rounds = await Promise.all(
		tees.map((tee) =>
			ctx.db
				.query("rounds")
				.withIndex("by_tee", (q) => q.eq("teeId", tee._id))
				.collect(),
		),
	);
	return rounds.flat();
}

/** Delete a course with its tees, holes and geometry. */
export async function deleteCourseData(
	ctx: MutationCtx,
	courseId: Id<"courses">,
) {
	for (const table of COURSE_CHILD_TABLES) {
		const docs = await ctx.db
			.query(table)
			.withIndex("by_course", (q) => q.eq("courseId", courseId))
			.collect();
		await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));
	}
	await ctx.db.delete(courseId);
}

/** Catalog courses plus the viewer's own copies, name-sorted. */
export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await viewerId(ctx);
		const catalog = await ctx.db
			.query("courses")
			.withIndex("by_owner", (q) => q.eq("ownerId", undefined))
			.collect();
		const own = userId
			? await ctx.db
					.query("courses")
					.withIndex("by_owner", (q) => q.eq("ownerId", userId))
					.collect()
			: [];
		return [...catalog, ...own.filter((c) => !c.retired)].sort((a, b) =>
			a.name.localeCompare(b.name),
		);
	},
});

/** One course with its tees (current only), holes (number-sorted), geometry. */
export const get = query({
	args: { courseId: v.id("courses") },
	handler: async (ctx, { courseId }) => {
		const course = await ctx.db.get(courseId);
		if (!course || !canSee(course, await viewerId(ctx))) return null;
		const [tees, holes, geometry] = await Promise.all([
			ctx.db
				.query("tees")
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect(),
			ctx.db
				.query("holes")
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect(),
			ctx.db
				.query("holeGeometry")
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect(),
		]);
		return {
			course,
			tees: tees.filter((t) => !t.retired),
			holes: holes
				.filter((h) => !h.retired)
				.sort((a, b) => a.number - b.number),
			geometry,
		};
	},
});

/** Copy a course (tees, holes, geometry) into a private, editable course. */
export const fork = mutation({
	args: { courseId: v.id("courses"), name: v.optional(v.string()) },
	handler: async (ctx, { courseId, name }) => {
		const userId = await getUserId(ctx);
		const source = await ctx.db.get(courseId);
		if (!source || !canSee(source, userId))
			throw new Error("Course not found.");
		const copyId = await ctx.db.insert("courses", {
			name: name?.trim() || source.name,
			city: source.city,
			location: source.location,
			osmRelationId: source.osmRelationId,
			ownerId: userId,
			forkedFrom: source._id,
		});
		for (const table of COURSE_CHILD_TABLES) {
			const docs = await ctx.db
				.query(table)
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect();
			for (const { _id, _creationTime, ...doc } of docs) {
				if ("retired" in doc && doc.retired) continue;
				await ctx.db.insert(table, { ...doc, courseId: copyId });
			}
		}
		return copyId;
	},
});

export const updateMeta = mutation({
	args: {
		courseId: v.id("courses"),
		name: v.optional(v.string()),
		city: v.optional(v.string()),
	},
	handler: async (ctx, { courseId, name, city }) => {
		await requireOwnCourse(ctx, courseId);
		const patch: { name?: string; city?: string } = {};
		if (name !== undefined) patch.name = name;
		if (city !== undefined) patch.city = city;
		await ctx.db.patch(courseId, patch);
	},
});

export const upsertTee = mutation({
	args: {
		teeId: v.optional(v.id("tees")),
		courseId: v.id("courses"),
		name: v.string(),
		color: v.optional(v.string()),
		courseRating: v.number(),
		slopeRating: v.number(),
	},
	handler: async (ctx, { teeId, ...fields }) => {
		await requireOwnCourse(ctx, fields.courseId);
		if (teeId) {
			const tee = await ctx.db.get(teeId);
			if (!tee || tee.courseId !== fields.courseId) {
				throw new Error("Tee does not belong to this course.");
			}
			await ctx.db.patch(teeId, fields);
			return teeId;
		}
		return await ctx.db.insert("tees", fields);
	},
});

/**
 * Set par and stroke index for a hole of the user's own copy. Omitted fields
 * keep their value; `null` clears.
 */
export const upsertHole = mutation({
	args: {
		holeId: v.id("holes"),
		par: v.optional(v.union(v.number(), v.null())),
		strokeIndex: v.optional(v.union(v.number(), v.null())),
	},
	handler: async (ctx, { holeId, par, strokeIndex }) => {
		const hole = await ctx.db.get(holeId);
		if (!hole) throw new Error("Hole not found.");
		await requireOwnCourse(ctx, hole.courseId);
		await ctx.db.patch(holeId, {
			...(par !== undefined && { par: par ?? undefined }),
			...(strokeIndex !== undefined && {
				strokeIndex: strokeIndex ?? undefined,
			}),
		});
	},
});

/**
 * Delete one of the user's own copies (never a catalog course). Refused while
 * an active round is on it. A copy finished rounds were played on is retired
 * instead: hidden from the list and new rounds, kept for their history.
 */
export const remove = mutation({
	args: { courseId: v.id("courses") },
	handler: async (ctx, { courseId }) => {
		await requireOwnCourse(ctx, courseId);
		const all = await roundsOnCourse(ctx, courseId);
		// A simulation keeps nothing worth a course: it goes with the course.
		await Promise.all(
			all.filter((r) => r.simulated).map((r) => deleteRoundData(ctx, r._id)),
		);
		const rounds = all.filter((r) => !r.simulated);
		if (rounds.some((r) => r.status === "active")) {
			// Clients map the code to their own copy (web course editor).
			throw new ConvexError({ code: "courseInActiveRound" });
		}
		if (rounds.length > 0) await ctx.db.patch(courseId, { retired: true });
		else await deleteCourseData(ctx, courseId);
	},
});

/**
 * Suggest a correction to a catalog course ("hole 7 is par 4", "the yellow
 * tee's slope is 129"). One sent from a copy attaches it as the worked-out fix.
 * Maintainers review open suggestions and edit convex/catalog.
 */
export const suggest = mutation({
	args: {
		courseId: v.id("courses"),
		message: v.string(),
	},
	handler: async (ctx, { courseId, message }) => {
		const userId = await getUserId(ctx);
		const course = await ctx.db.get(courseId);
		if (!course || !canSee(course, userId))
			throw new Error("Course not found.");
		// Suggestions on a copy are about the catalog course it came from.
		const isCopy = course.ownerId !== undefined;
		const catalogId = isCopy ? course.forkedFrom : course._id;
		if (!catalogId) {
			throw new Error("Only catalog courses take suggestions.");
		}
		const text = message.trim();
		if (text.length === 0) throw new Error("Describe what is wrong.");
		if (text.length > MAX_SUGGESTION_LENGTH) {
			throw new Error(
				`Keep the suggestion under ${MAX_SUGGESTION_LENGTH} characters.`,
			);
		}
		return await ctx.db.insert("courseSuggestions", {
			courseId: catalogId,
			userId,
			message: text,
			forkId: isCopy ? course._id : undefined,
			status: "open",
			createdAt: Date.now(),
		});
	},
});
