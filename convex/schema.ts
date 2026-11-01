import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const latLng = v.object({ lat: v.number(), lng: v.number() });
const polygon = v.array(latLng);

export default defineSchema({
	// A catalog course (no ownerId) is synced from convex/catalog and read-only
	// to users; a course with an ownerId is that user's private, editable copy.
	courses: defineTable({
		name: v.string(),
		catalogKey: v.optional(v.string()),
		ownerId: v.optional(v.string()),
		forkedFrom: v.optional(v.id("courses")),
		// A deleted copy that finished rounds still use: kept for their
		// history, hidden from the course list and new rounds.
		retired: v.optional(v.boolean()),
		city: v.optional(v.string()),
		location: v.optional(latLng),
		osmRelationId: v.optional(v.number()),
		externalRef: v.optional(v.object({ source: v.string(), id: v.string() })),
		// "manual" = hand-entered, "imported" = OSM import complete,
		// "partial" = imported but some holes lack par/SI/geometry.
		importStatus: v.union(
			v.literal("manual"),
			v.literal("imported"),
			v.literal("partial"),
		),
	})
		.index("by_catalog_key", ["catalogKey"])
		.index("by_owner", ["ownerId"]),

	tees: defineTable({
		courseId: v.id("courses"),
		name: v.string(),
		color: v.optional(v.string()),
		courseRating: v.number(),
		slopeRating: v.number(),
		// Dropped from the catalog but still referenced by a round: kept for
		// that round's history, hidden from new rounds.
		retired: v.optional(v.boolean()),
	}).index("by_course", ["courseId"]),

	holes: defineTable({
		courseId: v.id("courses"),
		number: v.number(),
		ref: v.optional(v.string()),
		par: v.optional(v.number()),
		strokeIndex: v.optional(v.number()),
		lengthMeters: v.optional(v.number()),
		// Dropped from the catalog but still in a round's holeRefs: kept for
		// that round's par and stroke index, hidden from the course.
		retired: v.optional(v.boolean()),
	}).index("by_course", ["courseId"]),

	holeGeometry: defineTable({
		courseId: v.id("courses"),
		// Unique per physical hole (distinguishes loops that reuse a number,
		// e.g. Welderen's "1" and "(1)"). holeNumber is kept for display/sort.
		ref: v.string(),
		holeNumber: v.number(),
		holeLine: v.optional(polygon),
		fairways: v.array(polygon),
		greens: v.array(polygon),
		bunkers: v.array(polygon),
		tees: v.array(polygon),
		water: v.array(polygon),
	})
		.index("by_course", ["courseId"])
		.index("by_course_hole", ["courseId", "holeNumber"]),

	userSettings: defineTable({
		userId: v.string(),
		units: v.union(v.literal("m"), v.literal("yd")),
		homeCourseId: v.optional(v.id("courses")),
		handicapIndex: v.optional(v.number()),
	}).index("by_user", ["userId"]),

	clubs: defineTable({
		userId: v.string(),
		name: v.string(),
		carryMeters: v.number(),
		sortOrder: v.number(),
	}).index("by_user", ["userId"]),

	rounds: defineTable({
		userId: v.string(),
		courseId: v.id("courses"),
		teeId: v.id("tees"),
		loopLabel: v.optional(v.string()),
		holeRefs: v.array(v.string()),
		startedAt: v.number(),
		format: v.union(v.literal("stroke"), v.literal("stableford")),
		status: v.union(v.literal("active"), v.literal("finished")),
		players: v.array(
			v.object({
				name: v.string(),
				handicapIndex: v.optional(v.number()),
				playingHandicap: v.optional(v.number()),
			}),
		),
		currentHoleIndex: v.optional(v.number()),
		totals: v.optional(
			v.array(
				v.object({
					strokes: v.number(),
					points: v.optional(v.number()),
				}),
			),
		),
		scoreDifferential: v.optional(v.union(v.number(), v.null())),
	})
		.index("by_user", ["userId"])
		.index("by_tee", ["teeId"]),

	holeScores: defineTable({
		roundId: v.id("rounds"),
		// 0-based position in the round's holeRefs (display number = index + 1).
		holeIndex: v.number(),
		playerIndex: v.number(),
		strokes: v.optional(v.number()),
		putts: v.optional(v.number()),
		fir: v.optional(v.boolean()),
		gir: v.optional(v.boolean()),
		penalties: v.optional(v.number()),
		nr: v.optional(v.boolean()),
	})
		.index("by_round", ["roundId"])
		.index("by_round_hole_player", ["roundId", "holeIndex", "playerIndex"]),

	// "This hole's par is wrong": a user's correction to a catalog course,
	// reviewed by a maintainer and applied to convex/catalog by hand.
	courseSuggestions: defineTable({
		courseId: v.id("courses"),
		userId: v.string(),
		message: v.string(),
		// Optional own copy with the fix already made, to diff against.
		forkId: v.optional(v.id("courses")),
		status: v.union(
			v.literal("open"),
			v.literal("applied"),
			v.literal("dismissed"),
		),
		createdAt: v.number(),
	})
		.index("by_course", ["courseId"])
		.index("by_status", ["status"])
		.index("by_user", ["userId"]),

	// Marked ball positions (owner only). Consecutive shots on one hole give
	// the distance hit with the earlier shot's club.
	shots: defineTable({
		userId: v.string(),
		roundId: v.id("rounds"),
		// 0-based position in the round's holeRefs.
		holeIndex: v.number(),
		position: latLng,
		club: v.optional(v.string()),
		markedAt: v.number(),
	})
		.index("by_round", ["roundId"])
		.index("by_user", ["userId"]),
});
