import * as Sentry from "@sentry/react-native";
import { sentryEnabled } from "./init";

const reported = new WeakSet<Error>();

/**
 * Reports a caught error once per error object, keeping its stack. For error
 * boundaries, which swallow what the global handler would otherwise see.
 * Never throws; the caller still renders its own error UI.
 */
export function reportError(error: unknown) {
	if (!sentryEnabled) return;
	const value =
		error instanceof Error ? error : new Error("Non-Error value thrown");
	if (reported.has(value)) return;
	reported.add(value);
	try {
		Sentry.captureException(value);
	} catch {
		// Reporting must never break the UI path that called it.
	}
}
