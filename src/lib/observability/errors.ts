import * as Sentry from "@sentry/react";
import { ConvexError } from "convex/values";

const reported = new WeakSet<object>();

/**
 * Report a caught failure once, keeping the original error and stack. A
 * `ConvexError` is an expected application error the UI shows, not a bug.
 * Callers rethrow so their own error handling still runs.
 */
export function reportError(error: unknown, operation: string): void {
	if (error instanceof ConvexError) return;
	if (typeof error === "object" && error !== null) {
		if (reported.has(error)) return;
		reported.add(error);
	}
	Sentry.captureException(
		error instanceof Error
			? error
			: new Error("Operation failed with a non-Error value"),
		{ tags: { operation, handled: true } },
	);
}
