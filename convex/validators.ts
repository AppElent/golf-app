import type { Units } from "@fairway/core/format";
import type { LatLng } from "@fairway/core/geo";
import type {
	FormatOptions,
	HoleScore,
	RoundFormat,
	RoundTeam,
	ScoreUpdate,
} from "@fairway/core/round";
import { type Infer, v } from "convex/values";

/**
 * Validators shared by the schema and function args, so a stored shape and the
 * write that fills it can't drift. `ValidatorsMatchCore` below fails to compile
 * when they stop matching @fairway/core.
 */

export const latLng = v.object({ lat: v.number(), lng: v.number() });

export const unitPreference = v.union(v.literal("m"), v.literal("yd"));

export const roundFormat = v.union(
	v.literal("stroke"),
	v.literal("stableford"),
	v.literal("match"),
	v.literal("skins"),
	v.literal("sixes"),
	v.literal("scramble"),
);

export const formatOptions = v.object({
	scoring: v.union(v.literal("net"), v.literal("gross")),
	carryOver: v.optional(v.boolean()),
});

export const roundTeam = v.object({ playerIndexes: v.array(v.number()) });

const unclearableScoreFields = {
	strokes: v.optional(v.number()),
	penalties: v.optional(v.number()),
	nr: v.optional(v.boolean()),
};

const missSide = v.union(v.literal("left"), v.literal("right"));

/** One player's stored result on one hole. */
export const holeScoreFields = {
	...unclearableScoreFields,
	putts: v.optional(v.number()),
	fir: v.optional(v.boolean()),
	firMiss: v.optional(missSide),
	gir: v.optional(v.boolean()),
	bunker: v.optional(v.boolean()),
};

/** A write to one result: omitted fields keep their value, `null` clears. */
export const scoreUpdateFields = {
	...unclearableScoreFields,
	putts: v.optional(v.union(v.number(), v.null())),
	fir: v.optional(v.union(v.boolean(), v.null())),
	firMiss: v.optional(v.union(missSide, v.null())),
	gir: v.optional(v.union(v.boolean(), v.null())),
	bunker: v.optional(v.union(v.boolean(), v.null())),
};

type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/** Keys too: an extra optional field alone leaves both types assignable. */
type Same<A, B> = Mutual<A, B> extends true ? Mutual<keyof A, keyof B> : false;
type Assert<T extends true> = T;

export type ValidatorsMatchCore = [
	Assert<Same<Infer<typeof latLng>, LatLng>>,
	Assert<Same<Infer<typeof unitPreference>, Units>>,
	Assert<Same<Infer<typeof roundFormat>, RoundFormat>>,
	Assert<Same<Infer<typeof formatOptions>, FormatOptions>>,
	Assert<Same<Infer<typeof roundTeam>, RoundTeam>>,
	Assert<
		Same<
			Infer<ReturnType<typeof v.object<typeof holeScoreFields>>>,
			Omit<HoleScore, "holeIndex" | "playerIndex">
		>
	>,
	Assert<
		Same<
			Infer<ReturnType<typeof v.object<typeof scoreUpdateFields>>>,
			ScoreUpdate
		>
	>,
];
