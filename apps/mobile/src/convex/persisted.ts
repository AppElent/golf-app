/**
 * What the last-known copy keeps (`query-cache.tsx`) and what the offline
 * fallback may read (APP-146). Its own module so pure code and tests can read
 * the allowlists without loading the React query hooks. Recorded in
 * `CODING_STANDARDS.md`.
 */

/**
 * The functions whose results persist, whole: what the play screen draws.
 * Anything not named here never touches disk.
 */
export const PERSISTED = new Set([
	"rounds:active",
	"courses:get",
	"settings:get",
	"clubs:list",
]);

/** Backend modules the offline fallback may read. Each is also persisted. */
export const OFFLINE_READABLE = new Set([
	"rounds",
	"courses",
	"settings",
	"clubs",
]);

/** Whether the offline fallback may read this function's copy. */
export function isOfflineReadable(name: string) {
	return PERSISTED.has(name) && OFFLINE_READABLE.has(name.split(":")[0]);
}
