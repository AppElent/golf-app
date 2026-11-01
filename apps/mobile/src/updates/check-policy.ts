/**
 * When to look for an EAS update after launch. expo-updates checks on every
 * cold start by itself; a phone that lives in the background for days (a
 * golf app is opened from the lock screen, not relaunched) would otherwise
 * never see one. Resuming checks again, at most once per interval.
 */
export const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function shouldCheckOnResume(
	lastCheckedAt: number | null,
	now: number,
): boolean {
	return lastCheckedAt === null || now - lastCheckedAt >= CHECK_INTERVAL_MS;
}
