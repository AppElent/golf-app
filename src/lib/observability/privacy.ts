/**
 * Redaction applied to every browser and Worker event before delivery. A
 * scorecard carries player names, scores and positions on the course; none of
 * that is needed to debug a failure, so only structure and stacks survive.
 */
import type { Breadcrumb, Event } from "@sentry/react";

/** Breadcrumb data keys that describe structure, never payloads. */
const BREADCRUMB_KEYS = ["url", "method", "status_code", "from", "to"];

function stripQuery(url: string): string {
	return url.split(/[?#]/)[0];
}

/** Redact credentials and identifiers that can appear in error text. */
export function sanitizeText(value: string): string {
	return (
		value
			.replace(/Bearer\s+[^\s"']+/gi, "Bearer [Filtered]")
			.replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[Filtered]")
			.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[Filtered]")
			.replace(
				/([?&](?:token|key|password|secret|email|code|authorization)=)[^&#\s]*/gi,
				"$1[Filtered]",
			)
			// Convex validator errors echo the rejected arguments.
			.replace(/^(\s*(?:Object|Value):).*$/gm, "$1 [Filtered]")
	);
}

export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
	// Console output can hold whole mutation payloads.
	if (breadcrumb.category === "console") return null;
	return {
		...breadcrumb,
		message: breadcrumb.message ? sanitizeText(breadcrumb.message) : undefined,
		data: breadcrumb.data
			? Object.fromEntries(
					Object.entries(breadcrumb.data)
						.filter(([key]) => BREADCRUMB_KEYS.includes(key))
						.map(([key, value]) => [
							key,
							typeof value === "string"
								? sanitizeText(stripQuery(value))
								: value,
						]),
				)
			: undefined,
	};
}

export function sanitizeEvent<T extends Event>(event: T): T {
	event.user = event.user?.id ? { id: event.user.id } : undefined;
	if (event.request) {
		event.request = {
			method: event.request.method,
			url: event.request.url
				? sanitizeText(stripQuery(event.request.url))
				: undefined,
		};
	}
	// Caller-supplied payloads are never needed to debug.
	delete event.extra;
	if (event.message) event.message = sanitizeText(event.message);
	for (const exception of event.exception?.values ?? []) {
		if (exception.value) exception.value = sanitizeText(exception.value);
		for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
	}
	if (event.breadcrumbs) {
		event.breadcrumbs = event.breadcrumbs.flatMap((breadcrumb) => {
			const clean = sanitizeBreadcrumb(breadcrumb);
			return clean ? [clean] : [];
		});
	}
	return event;
}
