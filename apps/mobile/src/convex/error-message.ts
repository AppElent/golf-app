/**
 * Convex throws `Error: <message>\n    at handler ...`: the server's message with
 * a stack welded on. Screens surface the first line, the part a human wrote.
 */
export function convexErrorMessage(error: unknown, fallback: string) {
	if (!(error instanceof Error)) return fallback;
	const [firstLine] = error.message.split("\n");
	const cleaned = firstLine.replace(/^\[.*?\]\s*/, "").trim();
	return cleaned.length > 0 ? cleaned : fallback;
}
