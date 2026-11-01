/**
 * Turns one `convex logs --jsonl` record into a Sentry exception, or `null`.
 * Only failed completions are forwarded, and only structural fields: never
 * log lines, arguments, return values or the caller's identity.
 * Format: FunctionExecutionJson in convex/dist/esm-types/cli/lib/generatedFunctionLogsApi.d.ts.
 */
import { createHash } from "node:crypto";

/** Same redaction as src/lib/observability/privacy.ts `sanitizeText`. */
export function sanitizeText(value) {
	return value
		.replace(/Bearer\s+[^\s"']+/gi, "Bearer [Filtered]")
		.replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[Filtered]")
		.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[Filtered]")
		.replace(
			/([?&](?:token|key|password|secret|email|code|authorization)=)[^&#\s]*/gi,
			"$1[Filtered]",
		)
		.replace(/^(\s*(?:Object|Value):).*$/gm, "$1 [Filtered]");
}

export function executionErrorEvent(entry, { deployment }) {
	if (entry?.kind !== "Completion") return null;
	if (typeof entry.error !== "string" || !entry.error) return null;
	if (typeof entry.identifier !== "string") return null;
	if (typeof entry.timestamp !== "number") return null;
	// An OCC conflict Convex retries is not a final failure.
	if (entry.willRetry === true) return null;

	const stack = sanitizeText(entry.error);
	const error = new Error(stack.split("\n")[0]);
	error.stack = stack;
	const eventId = createHash("sha256")
		.update(
			JSON.stringify([
				deployment,
				entry.requestId,
				entry.executionId,
				entry.identifier,
				entry.timestamp,
			]),
		)
		.digest("hex")
		.slice(0, 32);
	return {
		error,
		eventId,
		// Seconds, which is also what a Sentry event timestamp uses.
		timestamp: entry.timestamp,
		tags: {
			app: "fairway-convex",
			func: entry.identifier,
			func_type: String(entry.udfType || "unknown"),
			...(typeof entry.caller === "string" ? { caller: entry.caller } : {}),
			...(typeof entry.requestId === "string"
				? { request_id: entry.requestId }
				: {}),
		},
	};
}
