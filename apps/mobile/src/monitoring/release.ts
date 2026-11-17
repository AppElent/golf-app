/**
 * What this install is, in the releases standard's terms: the SemVer from
 * `app.json`, the native build number, the update channel, and the commit an
 * over-the-air update was published from. Plain data so a test can run it.
 * Policy: docs/runbooks/mobile.md#versions.
 */

/**
 * `fairway@<version>+<short sha>`, the name web and the Worker use too.
 * Only an update published by CI knows its commit (`EXPO_PUBLIC_COMMIT_SHA`,
 * set by the Mobile Update workflows); a bundle without one keeps the SDK's
 * default release, the one a native build's source maps are uploaded under.
 */
export function sentryRelease(
	version: string | null | undefined,
	commit: string | null | undefined,
): string | undefined {
	const sha = commit?.trim();
	if (!version || !sha) return undefined;
	return `fairway@${version}+${sha.slice(0, 7)}`;
}

/** The Profile footer: `1.4.0 (37) · production · 01a1e52b`. */
export function buildLabel(info: {
	version: string | null | undefined;
	build: string | null | undefined;
	channel: string | null | undefined;
	updateId: string | null | undefined;
	embedded: boolean;
}): string {
	const parts = [
		info.build
			? `${info.version ?? "–"} (${info.build})`
			: (info.version ?? "–"),
	];
	if (info.channel) parts.push(info.channel);
	if (info.updateId && !info.embedded) parts.push(info.updateId.slice(0, 8));
	return parts.join(" · ");
}
