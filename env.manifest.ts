// Every environment variable Fairway (web, apps/mobile, convex) reads, and who
// reads it. Values live in Infisical (`/` shared, `/fairway` app-specific, later
// folders win), never here. Routing is the shared model in
// docs/standards/environments.md: entries say which consumer reads a value in
// which environment; the engine picks the destination.
//
// App exception (docs/runbooks/deploy.md): the web preview and staging Workers
// are served on workers.dev, where the production Clerk instance cannot sign
// in, so their web builds and Convex backends use the Clerk development
// instance through the `webTestClerk*` entries.

export const ENV_CONFIG = {
	appName: "fairway",
	source: { paths: ["/", "/fairway"] },
	convex: {
		project: "eric-jansen:golf",
		deployments: {
			staging: "eric-jansen:golf:staging",
			production: "giddy-pelican-141",
		},
	},
	// The staging Worker predates the standard `<worker>-staging` name.
	worker: { name: "golf-app", names: { staging: "golf-app-stg" } },
	mobile: { path: "apps/mobile" },
	github: { repository: "AppElent/golf-app" },
};

export const ENVIRONMENTS = ["local", "preview", "staging", "production"] as const;

const WEB_DEPLOYED = ["preview", "staging", "production"];
const RELEASES = ["preview", "production"];

export const ENTRIES = [
	// ---------- Clerk ----------
	{
		key: "clerkPublishableKey",
		infisicalKey: "clerk-publishable-key",
		description: "Clerk publishable key: `pk_test_` in dev, `pk_live_` in staging and prod.",
		secret: false,
		lands: {
			"vite-build": { name: "VITE_CLERK_PUBLISHABLE_KEY", environments: ["local", "production"] },
			"expo-build": {
				name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
				environments: ["local", "preview", "production"],
			},
			"expo-local": { name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", environments: ["local"] },
		},
	},
	{
		key: "clerkJwtIssuerDomain",
		infisicalKey: "clerk-jwt-issuer-domain",
		description: "Issuer Convex trusts. A deployment without it refuses every signed-in call.",
		secret: false,
		lands: {
			"convex-functions": { name: "CLERK_JWT_ISSUER_DOMAIN", environments: ["local", "production"] },
		},
	},
	{
		key: "webTestClerkPublishableKey",
		infisicalKey: "web-test-clerk-publishable-key",
		description:
			"Clerk development-instance `pk_test_` key for the web preview and staging builds on workers.dev.",
		secret: false,
		lands: {
			"vite-build": { name: "VITE_CLERK_PUBLISHABLE_KEY", environments: ["preview", "staging"] },
		},
	},
	{
		key: "webTestClerkJwtIssuerDomain",
		infisicalKey: "web-test-clerk-jwt-issuer-domain",
		description: "Clerk development-instance issuer for the PR-preview and staging backends.",
		secret: false,
		lands: {
			"convex-functions": { name: "CLERK_JWT_ISSUER_DOMAIN", environments: ["preview", "staging"] },
		},
	},

	// ---------- Convex ----------
	{
		key: "convexUrl",
		infisicalKey: "convex-url",
		description:
			"Convex cloud URL the clients connect to. The phone needs the cloud URL, never localhost.",
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_CONVEX_URL",
				environments: ["local", ...WEB_DEPLOYED],
				suppliedIn: {
					preview: "convex deploy",
					staging: "convex deploy",
					production: "convex deploy",
				},
			},
			"expo-build": {
				name: "EXPO_PUBLIC_CONVEX_URL",
				environments: ["local", "preview", "production"],
			},
			"expo-local": { name: "EXPO_PUBLIC_CONVEX_URL", environments: ["local"] },
		},
	},
	{
		key: "convexDeployKey",
		infisicalKey: "convex-deploy-key",
		description: "Deploy key: preview kind in staging (PR previews), production kind in prod.",
		secret: true,
		lands: { workflow: { name: "CONVEX_DEPLOY_KEY", environments: RELEASES } },
	},
	{
		key: "convexStagingDeployKey",
		infisicalKey: "convex-staging-deploy-key",
		description:
			"`prod:` deploy key of the staging deployment. The deploy workflow refuses a missing or non-`prod:` key.",
		optional: true,
		secret: true,
		lands: { workflow: { name: "CONVEX_DEPLOY_KEY", environments: ["staging"] } },
	},

	// ---------- Test login (Clerk development instance only) ----------
	{
		key: "testUserEmail",
		infisicalKey: "test-user-email",
		description: "One-tap dev sign-in. Honoured only with a `pk_test_` key.",
		optional: true,
		secret: false,
		lands: { "expo-local": { name: "EXPO_PUBLIC_TEST_USER_EMAIL", environments: ["local"] } },
	},
	{
		key: "testUserPassword",
		infisicalKey: "test-user-password",
		description:
			"Password for that test user, published by design, so the account exists only on the development instance.",
		optional: true,
		secret: false,
		lands: { "expo-local": { name: "EXPO_PUBLIC_TEST_USER_PASSWORD", environments: ["local"] } },
	},

	// ---------- Sentry (project appelent/fairway, docs/runbooks/sentry.md) ----------
	{
		key: "sentryDsn",
		infisicalKey: "sentry-dsn",
		description: "Public Sentry DSN. Clients report from deployed hosts and release builds only.",
		optional: true,
		secret: false,
		lands: {
			"vite-build": { name: "VITE_SENTRY_DSN", environments: WEB_DEPLOYED },
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
		description: "Uploads source maps and debug symbols from deployed and released builds only.",
		optional: true,
		secret: true,
		lands: {
			workflow: { name: "SENTRY_AUTH_TOKEN", environments: WEB_DEPLOYED },
			"eas-tooling": { name: "SENTRY_AUTH_TOKEN", environments: RELEASES },
		},
	},

	// ---------- Maps ----------
	{
		key: "googleMapsAndroidApiKey",
		infisicalKey: "google-maps-android-api-key",
		description:
			"Google Maps SDK key for the Android satellite view (iOS uses Apple Maps). Without it Android draws the schematic.",
		optional: true,
		secret: true,
		lands: {
			"eas-tooling": {
				name: "GOOGLE_MAPS_ANDROID_API_KEY",
				environments: ["local", "preview", "production"],
			},
		},
	},

	// ---------- CI ----------
	{
		key: "expoToken",
		infisicalKey: "expo-token",
		description:
			"EAS access for the Mobile Build and Mobile Update workflows, which run without a GitHub Environment.",
		secret: true,
		lands: { workflow: { name: "EXPO_TOKEN", environments: ["preview"] } },
	},
	{
		key: "cloudflareApiToken",
		infisicalKey: "cloudflare-account-token",
		description: "Cloudflare token CI uses to deploy and delete Workers and attach the custom domain.",
		secret: true,
		lands: { workflow: { name: "CLOUDFLARE_API_TOKEN", environments: WEB_DEPLOYED } },
	},
	{
		key: "cloudflareAccountId",
		infisicalKey: "cloudflare-account-id",
		description: "Cloudflare account CI deploys Workers to.",
		secret: false,
		lands: { workflow: { name: "CLOUDFLARE_ACCOUNT_ID", environments: WEB_DEPLOYED } },
	},
];
