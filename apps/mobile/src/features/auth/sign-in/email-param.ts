/**
 * The `email` param of `/sign-in-code`, `/forgot-password` and `/reset-password`.
 *
 * Expo Router decodes a deep link's query and rebuilds it unencoded, so a
 * `+` (valid in an email, as in `me+golf@example.com`) comes out as a space
 * however it was percent-encoded. base64url has no `+`, `%` or `@`, so it
 * survives that round trip.
 */

/** The email as a URL-safe param value. */
export function emailToParam(email: string): string {
	return btoa(unescape(encodeURIComponent(email)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/**
 * The email behind a param value. A value holding an `@` is a plain email from
 * an older link; a value that does not decode is shown as given.
 */
export function emailFromParam(param: string | undefined): string | undefined {
	if (!param || param.includes("@")) return param;
	try {
		const base64 = param.replace(/-/g, "+").replace(/_/g, "/");
		return decodeURIComponent(escape(atob(base64)));
	} catch {
		return param;
	}
}
