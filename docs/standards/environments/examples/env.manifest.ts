// Copy to env.manifest.ts at the app root and delete what the app does not use.
// Values live in Infisical, never here. Routing is the shared model in
// docs/standards/environments.md: entries say which consumer reads a value in
// which environment; the engine picks the destination.
// Optional typing: import type { EnvironmentEntry } from "./scripts/lib/env/types.ts";

export const ENV_CONFIG = {
	appName: "replace-app",
	source: { paths: ["/", "/replace-app"] },
	convex: {
		project: "replace-team:replace-app",
		deployments: { production: "replace-prod-deployment" },
	},
	worker: { name: "replace-app" },
	mobile: { path: "apps/mobile" },
	github: { repository: "AppElent/replace-app" },
};

// Add "staging" (with convex.deployments.staging) when the app deploys one;
// the deploy workflow template expects it unless you drop its staging branch.
// Staging then needs its own `prod:` deploy key: a second entry
// (infisicalKey "convex-staging-deploy-key") landing on workflow for staging only.
export const ENVIRONMENTS = ["local", "preview", "production"] as const;

const ALL = ["local", "preview", "production"];
const DEPLOYED = ["preview", "production"];

export const ENTRIES = [
	{
		key: "convexUrl",
		infisicalKey: "convex-url",
		description: "Convex client URL",
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_CONVEX_URL",
				environments: ALL,
				suppliedIn: { preview: "convex deploy", production: "convex deploy" },
			},
			"expo-build": { name: "EXPO_PUBLIC_CONVEX_URL", environments: DEPLOYED },
			"expo-local": { name: "EXPO_PUBLIC_CONVEX_URL", environments: ["local"] },
		},
	},
	{
		key: "convexDeployKey",
		infisicalKey: "convex-deploy-key",
		description: "Deploy key: preview kind in staging, production kind in prod",
		secret: true,
		lands: { workflow: { name: "CONVEX_DEPLOY_KEY", environments: DEPLOYED } },
	},
	{
		key: "clerkPublishableKey",
		infisicalKey: "clerk-publishable-key",
		description: "pk_test_ in dev, pk_live_ in staging and prod",
		secret: false,
		lands: {
			"vite-build": { name: "VITE_CLERK_PUBLISHABLE_KEY", environments: ALL },
			"expo-build": { name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", environments: DEPLOYED },
			"expo-local": { name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", environments: ["local"] },
		},
	},
	{
		key: "clerkJwtIssuerDomain",
		infisicalKey: "clerk-jwt-issuer-domain",
		description: "Issuer Convex trusts",
		secret: false,
		lands: { "convex-functions": { name: "CLERK_JWT_ISSUER_DOMAIN", environments: ALL } },
	},
	{
		key: "testUserEmail",
		infisicalKey: "test-user-email",
		description: "+clerk_test address on the development instance",
		optional: true,
		secret: false,
		lands: { "vite-build": { name: "VITE_TEST_USER_EMAIL", environments: ["local"] } },
	},
	{
		key: "sentryDsn",
		infisicalKey: "sentry-dsn",
		description: "Public Sentry DSN",
		optional: true,
		secret: false,
		lands: { "vite-build": { name: "VITE_SENTRY_DSN", environments: DEPLOYED } },
	},
	{
		key: "sentryAuthToken",
		infisicalKey: "sentry-auth-token",
		description: "Source-map upload token",
		optional: true,
		secret: true,
		lands: {
			workflow: { name: "SENTRY_AUTH_TOKEN", environments: DEPLOYED },
			"eas-tooling": { name: "SENTRY_AUTH_TOKEN", environments: DEPLOYED },
		},
	},
	{
		key: "cloudflareApiToken",
		infisicalKey: "cloudflare-api-token",
		description: "Worker deploy token",
		secret: true,
		lands: { workflow: { name: "CLOUDFLARE_API_TOKEN", environments: DEPLOYED } },
	},
	{
		key: "cloudflareAccountId",
		infisicalKey: "cloudflare-account-id",
		description: "Cloudflare account for Worker deploys",
		secret: false,
		lands: { workflow: { name: "CLOUDFLARE_ACCOUNT_ID", environments: DEPLOYED } },
	},
];
