// OTA label: how every app names an OTA update, in the About/Settings screen,
// the EAS update message, and the changelog (standards/releases.md, "OTA label").
//
//   formatOtaLabel("1.0.0", "2026-11-20T09:12:00Z", "a1b2c3d4e5f6")  // "1.0.0 · 20 nov · a1b2c3d"
//
// `version` is the app version the update was built from (`expo.version`),
// `publishedAt` the publish time (Date, ISO string, or epoch ms), shown as the
// calendar day in Europe/Amsterdam, and `sha` the published commit (seven
// characters are shown). Pure and dependency-free: import it, or copy it
// unchanged, in the publish script and the app.

/** Dutch month abbreviations, as the label shows them. */
export const OTA_LABEL_MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

const amsterdam = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", day: "numeric", month: "numeric" });

/**
 * @param {string} version
 * @param {Date | string | number} publishedAt
 * @param {string} sha
 * @returns {string}
 */
export function formatOtaLabel(version, publishedAt, sha) {
	const date = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
	if (!version || Number.isNaN(date.getTime()) || !/^[0-9a-f]{7,40}$/i.test(sha ?? "")) {
		throw new TypeError(`formatOtaLabel: need a version, a publish date, and a commit sha (got ${version}, ${publishedAt}, ${sha})`);
	}
	const parts = Object.fromEntries(amsterdam.formatToParts(date).map((part) => [part.type, part.value]));
	return `${version} · ${Number(parts.day)} ${OTA_LABEL_MONTHS[Number(parts.month) - 1]} · ${sha.slice(0, 7).toLowerCase()}`;
}
