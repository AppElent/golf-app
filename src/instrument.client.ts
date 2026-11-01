/**
 * Browser Sentry. Imported first by `src/client.tsx`, so it runs before
 * hydration. Silent without a DSN, in `vite dev`, and on a local host — a
 * production bundle served from localhost is not a deployment.
 * Policy: docs/runbooks/sentry.md.
 */
import * as Sentry from "@sentry/react";
import {
	isLocalReportingUrl,
	sentryDataCollection,
	sentryEnvironment,
	tracesSampleRate,
} from "./lib/observability/config";
import { sanitizeBreadcrumb, sanitizeEvent } from "./lib/observability/privacy";

const dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN;
const environment = sentryEnvironment(import.meta.env.VITE_SENTRY_ENVIRONMENT);
const escapedOrigin = window.location.origin.replace(
	/[.*+?^${}()|[\]\\]/g,
	"\\$&",
);

Sentry.init({
	dsn,
	enabled:
		Boolean(dsn) &&
		!import.meta.env.DEV &&
		!isLocalReportingUrl(window.location.href),
	environment,
	release: import.meta.env.VITE_SENTRY_RELEASE,
	dataCollection: sentryDataCollection(),
	tracesSampleRate: tracesSampleRate(environment),
	// Same-origin only: Convex and Clerk get no trace headers.
	tracePropagationTargets: [new RegExp(`^${escapedOrigin}/`), /^\/(?!\/)/],
	// Static transactions pass through `beforeSendTransaction` for redaction.
	traceLifecycle: "static",
	initialScope: { tags: { app: "fairway-web" } },
	beforeSend: sanitizeEvent,
	beforeSendTransaction: sanitizeEvent,
	beforeBreadcrumb: sanitizeBreadcrumb,
	// The router integration is added in `src/router.tsx` once it exists.
	integrations: (defaults) =>
		defaults.filter((integration) => integration.name !== "Console"),
});
