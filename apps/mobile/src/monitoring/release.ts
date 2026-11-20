/**
 * What this install is, in the releases standard's terms: the SemVer from
 * `app.json`, the native build number, the update channel, and the commit an
 * over-the-air update was published from. Plain data so a test can run it.
 * Policy: docs/runbooks/mobile.md#versions.
 */
import { formatOtaLabel } from "../updates/ota-label.mjs";

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

/**
 * The OTA label of the update this phone runs (`1.0.0 · 20 nov · a1b2c3d`),
 * or null on the bundled code. An update published without a commit or a
 * creation date cannot be labelled; it shows its id instead (`buildLabel`).
 */
export function otaLabel(info: {
	version: string | null | undefined;
	createdAt: Date | null | undefined;
	commit: string | null | undefined;
	embedded: boolean;
}): string | null {
	if (info.embedded || !info.version || !info.createdAt || !info.commit)
		return null;
	try {
		return formatOtaLabel(info.version, info.createdAt, info.commit.trim());
	} catch {
		return null;
	}
}

/**
 * The Profile footer after "Versie": `1.0.0 (37) · update <label> · preview`,
 * `… · geen update · preview` on the bundled code (`noUpdate`, localized).
 * Standard: developer-home standards/releases.md, "OTA label".
 */
export function buildLabel(info: {
	version: string | null | undefined;
	build: string | null | undefined;
	channel: string | null | undefined;
	updateId: string | null | undefined;
	embedded: boolean;
	label: string | null;
	noUpdate: string;
}): string {
	const parts = [
		info.build
			? `${info.version ?? "–"} (${info.build})`
			: (info.version ?? "–"),
	];
	if (info.embedded) parts.push(info.noUpdate);
	else if (info.label) parts.push(`update ${info.label}`);
	else if (info.updateId) parts.push(`update ${info.updateId.slice(0, 8)}`);
	if (info.channel) parts.push(info.channel);
	return parts.join(" · ");
}
