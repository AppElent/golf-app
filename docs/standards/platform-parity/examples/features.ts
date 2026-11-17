// Copy to packages/core/src/features.ts and replace FEATURES with the app's
// features. Pure data: no imports, so it runs on web, Worker, Convex, and
// Hermes. scripts/feature-manifest-check.ts reads it in CI; screens may read
// it too (for example, to list which games the app offers).

export type Platform = "web" | "mobile";

/**
 * parity: on both platforms. exclusive: on one platform by design.
 * pending-port: meant for both platforms, on one for now.
 */
export type FeatureStatus = "parity" | "exclusive" | "pending-port";

/**
 * floor: required on both platforms (sign-in, account, export, deletion, ...).
 * share-target: someone without the app may open it from a link.
 * product: everything else.
 */
export type FeatureKind = "floor" | "share-target" | "product";

export interface Feature {
	/** Stable kebab-case id. */
	readonly id: string;
	readonly kind: FeatureKind;
	readonly status: FeatureStatus;
	/** Platforms that ship the feature today. Empty only for a pending-port feature that exists nowhere yet. */
	readonly platforms: readonly Platform[];
	/** Why the feature is not on both platforms. Required unless status is "parity". */
	readonly reason?: string;
	/** Web layout. Defaults to "responsive"; "large-screen" needs layoutReason. */
	readonly layout?: "responsive" | "large-screen";
	readonly layoutReason?: string;
	/**
	 * Route files owned by the feature, relative to each platform's route root
	 * and without extension. `*` matches within one path segment, `**` across
	 * segments: "recipes/**", "(app)/(tabs)/settings/*".
	 */
	readonly routes: { readonly web?: readonly string[]; readonly mobile?: readonly string[] };
}

export const defineFeatures = <const T extends readonly Feature[]>(features: T): T => features;

export const FEATURES = defineFeatures([
	{
		id: "sign-in",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["sign-in", "sign-up", "forgot-password"], mobile: ["(auth)/**"] },
	},
	{
		id: "course-editor",
		kind: "product",
		status: "exclusive",
		platforms: ["web"],
		reason: "Authoring needs a map and a keyboard; the phone is for playing.",
		layout: "large-screen",
		layoutReason: "Editing hole geometry needs a large map.",
		routes: { web: ["courses.$courseId.edit"] },
	},
]);
