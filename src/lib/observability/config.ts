/**
 * Shared Sentry settings for the browser (`src/instrument.client.ts`) and the
 * Worker (`src/server.ts`). Policy: docs/runbooks/sentry.md.
 */

/** Automatic collection off: the event hooks in `privacy.ts` decide the rest. */
export function sentryDataCollection() {
	return {
		userInfo: false,
		cookies: false,
		httpHeaders: false,
		httpBodies: [],
		urlQueryParams: false,
		stackFrameVariables: false,
		databaseQueryData: false,
		queues: false,
		graphQL: { document: false, variables: false },
		genAI: { inputs: false, outputs: false },
		mcp: { inputs: false, outputs: false },
	};
}

/**
 * The deployment a build was made for, set by the deploying command
 * (`VITE_SENTRY_ENVIRONMENT`) — never the Vite build mode, since a production
 * bundle also runs on localhost and in the check-only CI build.
 */
export function sentryEnvironment(value: string | undefined): string {
	return value?.trim() || "unknown";
}

/** Transactions cost quota; production samples, previews keep everything. */
export function tracesSampleRate(environment: string): number {
	return environment === "production" ? 0.1 : 1;
}

/**
 * Production bundles also run in local `vite preview` / Wrangler sessions,
 * which can carry production bindings. Compare the parsed hostname only.
 */
export function isLocalReportingUrl(url: string): boolean {
	const hostname = new URL(url).hostname.toLowerCase();
	return (
		hostname === "localhost" ||
		hostname.endsWith(".localhost") ||
		hostname === "[::1]" ||
		hostname === "0.0.0.0" ||
		/^127\.\d+\.\d+\.\d+$/.test(hostname)
	);
}
