/**
 * When to look for an EAS update after launch. expo-updates checks on every
 * cold start by itself; a phone that lives in the background for days (a
 * golf app is opened from the lock screen, not relaunched) would otherwise
 * never see one. Resuming checks again, at most once per interval.
 */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function shouldCheckOnResume(
	lastCheckedAt: number,
	now: number,
): boolean {
	return now - lastCheckedAt >= CHECK_INTERVAL_MS;
}
