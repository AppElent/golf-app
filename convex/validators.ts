import type { Units } from "@fairway/core/format";
import type { LatLng } from "@fairway/core/geo";
import type { HoleScore, RoundFormat, ScoreUpdate } from "@fairway/core/round";
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
);

const unclearableScoreFields = {
	strokes: v.optional(v.number()),
	penalties: v.optional(v.number()),
	nr: v.optional(v.boolean()),
};

/** One player's stored result on one hole. */
export const holeScoreFields = {
	...unclearableScoreFields,
	putts: v.optional(v.number()),
	fir: v.optional(v.boolean()),
	gir: v.optional(v.boolean()),
};

/** A write to one result: omitted fields keep their value, `null` clears. */
export const scoreUpdateFields = {
	...unclearableScoreFields,
	putts: v.optional(v.union(v.number(), v.null())),
	fir: v.optional(v.union(v.boolean(), v.null())),
	gir: v.optional(v.union(v.boolean(), v.null())),
};

type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/** Keys too: an extra optional field alone leaves both types assignable. */
type Same<A, B> = Mutual<A, B> extends true ? Mutual<keyof A, keyof B> : false;
type Assert<T extends true> = T;

export type ValidatorsMatchCore = [
	Assert<Same<Infer<typeof latLng>, LatLng>>,
	Assert<Same<Infer<typeof unitPreference>, Units>>,
	Assert<Same<Infer<typeof roundFormat>, RoundFormat>>,
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
