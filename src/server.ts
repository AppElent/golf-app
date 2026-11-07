/**
 * Worker entry (`wrangler.jsonc` `main`). Deployed requests run through
 * Sentry's Cloudflare wrapper; local ones skip it entirely, because Wrangler
 * and `vite preview` can serve a production build with production bindings.
 * Policy: docs/runbooks/sentry.md.
 */
import * as Sentry from "@sentry/cloudflare";
import handler from "@tanstack/react-start/server-entry";
import {
	isLocalReportingUrl,
	sentryEnvironment,
	sharedSentryOptions,
} from "./lib/observability/config";

type SentryEnv = {
	/** Runtime override of the build-time DSN. */
	SENTRY_DSN?: string;
	/** Set per deployment, e.g. `--var environment_name:preview`. */
	environment_name?: string;
};

const instrumentedHandler = Sentry.withSentry(
	(env: SentryEnv) => {
		const dsn: string | undefined =
			env.SENTRY_DSN || import.meta.env.VITE_SENTRY_DSN;
		const environment = sentryEnvironment(
			env.environment_name || import.meta.env.VITE_SENTRY_ENVIRONMENT,
		);
		return {
			...sharedSentryOptions(environment),
			dsn,
			enabled: Boolean(dsn) && !import.meta.env.DEV,
			initialScope: { tags: { app: "fairway-web-server" } },
		};
	},
	{
		async fetch(request: Request, _env: SentryEnv, _ctx: ExecutionContext) {
			const response = await handler.fetch(request);
			// Start can turn an SSR error into a 500 response instead of throwing.
			if (response.status >= 500) {
				Sentry.captureMessage("TanStack Start returned a server error", {
					level: "error",
					tags: { status: response.status },
				});
			}
			return response;
		},
	},
);

export default {
	fetch(request: Request, env: SentryEnv, ctx: ExecutionContext) {
		if (isLocalReportingUrl(request.url)) return handler.fetch(request);
		return instrumentedHandler.fetch(request, env, ctx);
	},
};
