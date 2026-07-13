import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const latLng = v.object({ lat: v.number(), lng: v.number() });
const polygon = v.array(latLng);

export default defineSchema({
	courses: defineTable({
		name: v.string(),
		city: v.optional(v.string()),
		location: v.optional(latLng),
		osmRelationId: v.optional(v.number()),
		externalRef: v.optional(
			v.object({ source: v.string(), id: v.string() }),
		),
		// "manual" = hand-entered, "imported" = OSM import complete,
		// "partial" = imported but some holes lack par/SI/geometry.
		importStatus: v.union(
			v.literal("manual"),
			v.literal("imported"),
			v.literal("partial"),
		),
	}),

	tees: defineTable({
		courseId: v.id("courses"),
		name: v.string(),
		color: v.optional(v.string()),
		courseRating: v.number(),
		slopeRating: v.number(),
	}).index("by_course", ["courseId"]),

	holes: defineTable({
		courseId: v.id("courses"),
		number: v.number(),
		ref: v.optional(v.string()),
		par: v.optional(v.number()),
		strokeIndex: v.optional(v.number()),
		lengthMeters: v.optional(v.number()),
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
	}).index("by_user", ["userId"]),

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
});
