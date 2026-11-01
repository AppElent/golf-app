import "./instrument.client";
import * as Sentry from "@sentry/react";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<StartClient />
		</StrictMode>,
		{
			// Render and query errors, including those a route boundary catches.
			onUncaughtError: Sentry.reactErrorHandler(),
			onCaughtError: Sentry.reactErrorHandler(),
			onRecoverableError: Sentry.reactErrorHandler(),
		},
	);
});
