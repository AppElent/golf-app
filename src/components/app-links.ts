/** App Store Connect id of the Fairway iPhone app (`apps/mobile/eas.json`,
 *  `submit.production.ios.ascAppId`); `app-links.test.ts` keeps them equal. */
export const APP_STORE_ID = "6833832527";

export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;

/** The TestFlight Public group's join link (docs/runbooks/mobile.md). */
export const TESTFLIGHT_URL = "https://testflight.apple.com/join/5SAF8udZ";

/**
 * Web paths of the round screens retired in APP-235 (ADR 0001). The Worker
 * (`src/server.ts`) sends them to `/`, the "Open the Fairway app" page, so old
 * bookmarks and an installed web app's history land somewhere useful.
 */
export const RETIRED_PATHS = [
	"/play",
	"/card",
	"/rounds/new",
	"/progress",
] as const;

export function isRetiredPath(pathname: string): boolean {
	const path = pathname.replace(/\/+$/, "") || "/";
	return (RETIRED_PATHS as readonly string[]).includes(path);
}
