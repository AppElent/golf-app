// Which platform each Fairway feature ships on, from the platform-parity
// standard (AppElent/developer-home#2) and the parity ADR,
// docs/adr/0001-the-phone-plays-rounds-and-the-web-authors-courses.md.
// Pure data: no imports, so it runs on web, Worker, Convex, and Hermes.
// scripts/feature-manifest.test.ts fails CI when a route file on either
// platform belongs to no feature, or a pattern here matches no route.

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
	 * (`src/routes`, `apps/mobile/app`) and without extension. `*` matches
	 * within one path segment, `**` across segments.
	 */
	readonly routes: {
		readonly web?: readonly string[];
		readonly mobile?: readonly string[];
	};
}

export const defineFeatures = <const T extends readonly Feature[]>(
	features: T,
): T => features;

const ADR =
	"docs/adr/0001-the-phone-plays-rounds-and-the-web-authors-courses.md";

export const FEATURES = defineFeatures([
	// Floor. The web floor is reduced to sign-in, sign-out, privacy, account
	// deletion and data export (ADR). Everything else on the floor is owed by
	// the phone only.
	{
		id: "sign-in",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		// Sign-in and sign-up. Web: Clerk's prebuilt <SignIn> inside AuthGate
		// (src/integrations/clerk), no route; sign-up is that card's Clerk link.
		// Mobile: password or emailed-code sign-in, sign-up, email verification.
		routes: { mobile: ["(auth)/**"] },
	},
	{
		id: "password-reset",
		kind: "floor",
		status: "pending-port",
		platforms: ["web"],
		reason: `Owed on the phone (${ADR}). The web's Clerk <SignIn> card has Clerk's forgot-password step; the phone has none. Emailed-code sign-in gets a user in but does not change the password.`,
		routes: {},
	},
	{
		id: "sign-out",
		kind: "floor",
		status: "pending-port",
		platforms: ["mobile"],
		reason: `In the reduced web floor (${ADR}), but the web shell has no sign-out control yet. The phone signs out from the Profile tab.`,
		routes: {},
	},
	{
		id: "account-deletion",
		kind: "floor",
		status: "pending-port",
		platforms: ["mobile"],
		reason: `In the reduced web floor (${ADR}), but only the phone deletes an account (Profile tab: convex/account.ts deleteMyData, then the Clerk user). The web port reuses that mutation.`,
		routes: {},
	},
	{
		id: "data-export",
		kind: "floor",
		status: "pending-port",
		platforms: [],
		reason: `Owed on both platforms (${ADR}); neither exports a user's data yet.`,
		routes: {},
	},
	{
		id: "privacy",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		// Mobile opens the public web page from the Profile tab.
		routes: { web: ["privacy"] },
	},
	{
		id: "account-profile",
		kind: "floor",
		status: "pending-port",
		platforms: [],
		reason: `Not in the reduced web floor (${ADR}), so only the phone owes it. The phone shows the email read-only and cannot change name, email or password yet.`,
		routes: {},
	},
	{
		id: "language",
		kind: "floor",
		status: "exclusive",
		platforms: ["mobile"],
		reason: `Reduced web floor (${ADR}): the web is English-only; the phone offers English and Dutch.`,
		routes: {},
	},
	{
		id: "theme",
		kind: "floor",
		status: "exclusive",
		platforms: ["mobile"],
		reason: `Reduced web floor (${ADR}): the web follows the OS colour scheme with no in-app choice; the phone offers system, light and dark.`,
		routes: {},
	},

	// Product: playing and reviewing rounds (the phone leads).
	{
		id: "home",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["index"], mobile: ["(app)/(tabs)/(home)/index"] },
	},
	{
		id: "round-setup",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: ["rounds.new"],
			mobile: ["(app)/(tabs)/(home)/courses", "(app)/(tabs)/(home)/setup/*"],
		},
	},
	{
		id: "round-play",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		// The web copy predates the phone app; see the ADR before extending it.
		routes: {
			web: ["play", "card"],
			mobile: ["(app)/play", "(app)/score", "(app)/scorecard"],
		},
	},
	{
		id: "round-history",
		kind: "product",
		status: "exclusive",
		platforms: ["mobile"],
		reason:
			"Reviewing past rounds is the phone's job (ADR 0001). The web home shows only the last round. Includes sharing a round as an image and text, which is not a link.",
		routes: { mobile: ["(app)/(tabs)/rounds/**"] },
	},
	{
		id: "live-hole",
		kind: "product",
		status: "exclusive",
		platforms: ["mobile"],
		reason:
			"Background location and the lock-screen hole view during a round need the native app.",
		routes: {},
	},
	{
		id: "stats",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["progress"], mobile: ["(app)/(tabs)/stats/index"] },
	},
	{
		id: "simulator",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		// Web: rounds.new?simulate, opened from the profile page.
		routes: { web: ["rounds.new"], mobile: ["(app)/(tabs)/profile/simulator"] },
	},

	// Product: the golfer's profile.
	{
		id: "settings",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		// Units, GPS notes, and the entry to the profile sub-pages.
		routes: { web: ["profile"], mobile: ["(app)/(tabs)/profile/index"] },
	},
	{
		id: "handicap",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		// Web: a section of the profile page.
		routes: { mobile: ["(app)/(tabs)/profile/handicap"] },
	},
	{
		id: "home-course",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		// Web: a section of the profile page.
		routes: { mobile: ["(app)/(tabs)/profile/home-course"] },
	},
	{
		id: "club-bag",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		// Web: a section of the profile page.
		routes: {
			mobile: ["(app)/(tabs)/profile/clubs", "(app)/(tabs)/profile/club"],
		},
	},

	// Product: courses (the web authors them).
	{
		id: "course-authoring",
		kind: "product",
		status: "exclusive",
		platforms: ["web"],
		reason:
			"Authoring courses (copies of catalog courses, tees, holes) is the web's job (ADR 0001); the phone only picks a course to play.",
		layout: "large-screen",
		layoutReason:
			"Editing a course's tees and holes, and later its geometry on a map, needs a large screen and a keyboard.",
		routes: { web: ["courses.index", "courses.$courseId.edit"] },
	},
	{
		id: "course-suggestion",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		// Web: a section of the course editor.
		routes: {
			web: ["courses.$courseId.edit"],
			mobile: ["(app)/suggest/*"],
		},
	},

	// Product: help.
	{
		id: "support",
		kind: "product",
		status: "exclusive",
		platforms: ["web"],
		reason:
			"A public page the App Store listing links to. The phone reports problems in-app instead (problem-report).",
		routes: { web: ["support"] },
	},
	{
		id: "problem-report",
		kind: "product",
		status: "exclusive",
		platforms: ["mobile"],
		reason:
			"Sends a Sentry user-feedback report from the device. Web users reach the support page.",
		routes: {},
	},
]);

export type FeatureId = (typeof FEATURES)[number]["id"];
