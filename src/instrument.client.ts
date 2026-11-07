/**
 * Browser Sentry. Imported first by `src/client.tsx`, so it runs before
 * hydration. Silent without a DSN, in `vite dev`, and on a local host — a
 * production bundle served from localhost is not a deployment.
 * Policy: docs/runbooks/sentry.md.
 */
import * as Sentry from "@sentry/react";
import {
	isLocalReportingUrl,
	sentryEnvironment,
	sharedSentryOptions,
} from "./lib/observability/config";

const dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN;
const environment = sentryEnvironment(import.meta.env.VITE_SENTRY_ENVIRONMENT);
const escapedOrigin = window.location.origin.replace(
	/[.*+?^${}()|[\]\\]/g,
	"\\$&",
);

Sentry.init({
	// The router integration is added in `src/router.tsx` once it exists.
	...sharedSentryOptions(environment),
	dsn,
	enabled:
		Boolean(dsn) &&
		!import.meta.env.DEV &&
		!isLocalReportingUrl(window.location.href),
	// Same-origin only: Convex and Clerk get no trace headers.
	tracePropagationTargets: [new RegExp(`^${escapedOrigin}/`), /^\/(?!\/)/],
	initialScope: { tags: { app: "fairway-web" } },
});
