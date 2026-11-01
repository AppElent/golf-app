/**
 * Every environment variable Fairway (web + apps/mobile + convex) needs, and
 * who reads it. Values live in Infisical (`/` shared, `/fairway` app-specific,
 * later folders win) — never in this file.
 *
 * An entry declares its **consumer**; `destinationFor()` derives where that
 * consumer reads it per environment. Run with `node scripts/env.mjs …` — see
 * docs/standards/environments.md and docs/runbooks/mobile.md.
 *
 * Scope: the local files, Convex deployment env, EAS environments and the
 * repo-level CI secrets (`EXPO_TOKEN`, `CLOUDFLARE_*`). Still set by hand:
 * the three `CONVEX_DEPLOY_KEY`s (repo = preview, `stg` and `production`
 * GitHub environments) and `PREVIEW_CLERK_PUBLISHABLE_KEY` (Clerk test
 * instance); Infisical holds no values for them yet.
 */

export const ENV_CONFIG = {
	appName: "fairway",
	source: {
		environments: { local: "dev", preview: "staging", production: "prod" },
		paths: ["/", "/fairway"],
	},
	mobile: { path: "apps/mobile" },
	github: { repository: "AppElent/golf-app" },
} as const;

export const ENVIRONMENTS = ["local", "preview", "production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/**
 * - `vite-build` / `expo-build` / `expo-local` are inlined into a client
 *   bundle, so they are public by construction.
 * - `eas-tooling` is read by the native build on EAS (never inlined).
 * - `workflow` authenticates a GitHub Actions job.
 */
export const CONSUMERS = [
	"vite-build",
	"convex-functions",
	"expo-build",
	"expo-local",
	"eas-tooling",
	"workflow",
] as const;
export type Consumer = (typeof CONSUMERS)[number];

export type Destination =
	| { kind: "file"; path: string }
	| { kind: "convex"; target: "dev" | "preview-default" | "production" }
	| { kind: "github"; scope: "repo" }
	| { kind: "eas"; environment: "development" | "preview" | "production" };

/** `null` means the consumer does not exist in that environment. */
export function destinationFor(
	consumer: Consumer,
	environment: Environment,
): Destination | null {
	switch (consumer) {
		// Deployed web builds get their values from CI (see preview.yml).
		case "vite-build":
			return environment === "local"
				? { kind: "file", path: ".env.local" }
				: null;
		case "convex-functions":
			switch (environment) {
				case "local":
					return { kind: "convex", target: "dev" };
				case "preview":
					return { kind: "convex", target: "preview-default" };
				case "production":
					return { kind: "convex", target: "production" };
			}
			break;
		// EAS development is a real cloud environment fed from the dev source.
		case "expo-build":
		case "eas-tooling":
			switch (environment) {
				case "local":
					return { kind: "eas", environment: "development" };
				case "preview":
					return { kind: "eas", environment: "preview" };
				case "production":
					return { kind: "eas", environment: "production" };
			}
			break;
		// Metro reads a file and only exists on a developer's machine.
		case "expo-local":
			return environment === "local"
				? { kind: "file", path: "apps/mobile/.env.local" }
				: null;
		// One repo-scoped secret serves every mobile build job.
		case "workflow":
			return environment === "production"
				? { kind: "github", scope: "repo" }
				: null;
	}
	return null;
}

type Landing = { name: string; environments: readonly Environment[] };
type ClientLanding<P extends string> = Landing & { name: `${P}${string}` };
type Lands = Partial<
	Record<Exclude<Consumer, "vite-build" | "expo-build" | "expo-local">, Landing>
> & {
	"vite-build"?: ClientLanding<"VITE_">;
	"expo-build"?: ClientLanding<"EXPO_PUBLIC_">;
	"expo-local"?: ClientLanding<"EXPO_PUBLIC_">;
};

type BaseEntry = {
	key: string;
	infisicalKey: string;
	description: string;
	optional?: true;
	lands: Lands;
};

/** A secret can never land in a client bundle — the type refuses it. */
export type Entry =
	| (BaseEntry & { secret: false })
	| (BaseEntry & {
			secret: true;
			lands: Omit<Lands, "vite-build" | "expo-build" | "expo-local">;
	  });

const ALL = ["local", "preview", "production"] as const;
const RELEASES = ["preview", "production"] as const;

export const ENTRIES = [
	// ---------- Clerk (shared root folder) ----------
	{
		key: "clerkPublishableKey",
		infisicalKey: "clerk-publishable-key",
		description: "Clerk publishable key. `pk_test_…` locally, `pk_live_…` for releases.",
		secret: false,
		lands: {
			"vite-build": { name: "VITE_CLERK_PUBLISHABLE_KEY", environments: ["local"] },
			"expo-build": { name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", environments: ALL },
			"expo-local": { name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", environments: ["local"] },
		},
	},
	{
		key: "clerkJwtIssuerDomain",
		infisicalKey: "clerk-jwt-issuer-domain",
		description:
			"Clerk ↔ Convex auth bridge. A deployment without it refuses every signed-in call.",
		secret: false,
		lands: {
			// Not preview: PR-preview backends pair with the web preview's
			// test-instance key (PREVIEW_CLERK_PUBLISHABLE_KEY), set by hand.
			"convex-functions": {
				name: "CLERK_JWT_ISSUER_DOMAIN",
				environments: ["local", "production"],
			},
		},
	},

	// ---------- Convex (/fairway) ----------
	{
		key: "convexUrl",
		infisicalKey: "convex-url",
		description:
			"Convex cloud URL the clients connect to. The phone needs the cloud URL, never localhost.",
		secret: false,
		lands: {
			"vite-build": { name: "VITE_CONVEX_URL", environments: ["local"] },
			"expo-build": { name: "EXPO_PUBLIC_CONVEX_URL", environments: ALL },
			"expo-local": { name: "EXPO_PUBLIC_CONVEX_URL", environments: ["local"] },
		},
	},

	// ---------- Test login (Clerk test instance only) ----------
	{
		key: "testUserEmail",
		infisicalKey: "test-user-email",
		description: "One-tap dev sign-in. Honoured only with a `pk_test_` key.",
		optional: true,
		secret: false,
		lands: {
			"expo-local": { name: "EXPO_PUBLIC_TEST_USER_EMAIL", environments: ["local"] },
		},
	},
	{
		key: "testUserPassword",
		infisicalKey: "test-user-password",
		description:
			"Password for that test user — published by design, so the account exists only on the Clerk test instance.",
		optional: true,
		secret: false,
		lands: {
			"expo-local": { name: "EXPO_PUBLIC_TEST_USER_PASSWORD", environments: ["local"] },
		},
	},

	// ---------- Sentry (/fairway, project appelent/fairway) ----------
	{
		key: "sentryDsn",
		infisicalKey: "sentry-dsn",
		description:
			"Sentry DSN (public by design). The phone reports from release builds only.",
		optional: true,
		secret: false,
		lands: {
			"expo-build": { name: "EXPO_PUBLIC_SENTRY_DSN", environments: RELEASES },
		},
	},
	{
		key: "sentryOrg",
		infisicalKey: "sentry-org",
		description: "Sentry organisation slug, for debug-symbol and source-map upload.",
		optional: true,
		secret: false,
		lands: { "eas-tooling": { name: "SENTRY_ORG", environments: RELEASES } },
	},
	{
		key: "sentryProject",
		infisicalKey: "sentry-project",
		description: "Sentry project slug, for debug-symbol and source-map upload.",
		optional: true,
		secret: false,
		lands: { "eas-tooling": { name: "SENTRY_PROJECT", environments: RELEASES } },
	},
	{
		key: "sentryAuthToken",
		infisicalKey: "sentry-auth-token",
		description:
			"Uploads debug symbols and source maps from EAS release builds. Never inlined.",
		optional: true,
		secret: true,
		lands: { "eas-tooling": { name: "SENTRY_AUTH_TOKEN", environments: RELEASES } },
	},

	// ---------- Maps ----------
	{
		key: "googleMapsAndroidApiKey",
		infisicalKey: "google-maps-android-api-key",
		description:
			"Google Maps SDK key for the Android satellite view (iOS uses Apple Maps, no key). Without it Android draws the schematic.",
		optional: true,
		secret: true,
		lands: {
			"eas-tooling": { name: "GOOGLE_MAPS_ANDROID_API_KEY", environments: ALL },
		},
	},

	// ---------- CI ----------
	{
		key: "expoToken",
		infisicalKey: "expo-token",
		description: "Lets the Mobile Build workflow run `eas build --local` on the runner.",
		secret: true,
		lands: { workflow: { name: "EXPO_TOKEN", environments: ["production"] } },
	},
	{
		key: "cloudflareApiToken",
		infisicalKey: "cloudflare-account-token",
		description:
			"Cloudflare token CI uses to deploy and remove Workers and attach the custom domain.",
		secret: true,
		lands: {
			workflow: { name: "CLOUDFLARE_API_TOKEN", environments: ["production"] },
		},
	},
	{
		key: "cloudflareAccountId",
		infisicalKey: "cloudflare-account-id",
		description: "Cloudflare account CI deploys Workers to.",
		secret: true,
		lands: {
			workflow: { name: "CLOUDFLARE_ACCOUNT_ID", environments: ["production"] },
		},
	},
] as const satisfies readonly Entry[];

export type Placement = {
	entry: Entry;
	consumer: Consumer;
	environment: Environment;
	name: string;
	destination: Destination;
	suppliedBy: string | null;
};

/** Every placement for an environment, in manifest order. */
export function placementsFor(environment: Environment): Placement[] {
	const placements: Placement[] = [];
	for (const entry of ENTRIES as readonly Entry[]) {
		for (const consumer of CONSUMERS) {
			const landing = entry.lands[consumer];
			if (!landing?.environments.includes(environment)) continue;
			const destination = destinationFor(consumer, environment);
			if (!destination) continue;
			placements.push({
				entry,
				consumer,
				environment,
				name: landing.name,
				destination,
				suppliedBy: null,
			});
		}
	}
	return placements;
}
