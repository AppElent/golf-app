/**
 * App links: the https links on the web origin that the installed app claims
 * (iOS universal links; Android app links when a project adds them).
 *
 * Contract:
 * - Copy to `apps/mobile/src/lib/app-links.ts` and call `createAppLinks` once,
 *   in a module both `app.config.ts` and the app can import (no React Native
 *   imports here, so the config can load it).
 * - A link is either a path with one variable segment (`/join/*`, validated
 *   whole by `param`) or an exact path whose query carries the values
 *   (`/join?token=…`, each key validated by `query`; unknown keys are
 *   dropped). Matching is case-sensitive, like the claimed AASA paths.
 * - Regular expressions rather than `URL`: React Native's `URL` polyfill lacks
 *   `pathname`, and `+native-intent` must never throw.
 * - `buildAasa` produces the exact JSON for
 *   `public/.well-known/apple-app-site-association`; the
 *   [test example](app-links.test.ts) keeps the file and this config in step.
 */

export interface SegmentLink {
	/** The claimed path, AASA syntax with one trailing `*`: `/join/*`. */
	path: `/${string}/*`;
	/** Validates the whole variable segment: `/^[A-Za-z0-9]+$/`. */
	param: RegExp;
	/** The app route the link opens: `(token) => \`/join/${token}\``. */
	route: (param: string) => string;
	/** Why the app claims it; becomes the AASA component comment. */
	comment: string;
}

export interface QueryLink {
	/** The exact claimed path, no `*`: `/join`. */
	path: `/${string}`;
	/** The query keys the route takes, each with its validator. */
	query: Readonly<Record<string, RegExp>>;
	/** The app route for the valid keys (possibly none): `/join?token=…`. */
	route: (params: Readonly<Record<string, string>>) => string;
	comment: string;
}

export type AppLink = SegmentLink | QueryLink;

export interface AppLinksConfig {
	/** The production web host: `foundry.appelent.nl`. */
	host: string;
	/** Every variant's app scheme: `["foundry", "foundry-preview", "foundry-dev"]`. */
	schemes: readonly string[];
	links: readonly AppLink[];
}

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
const isSegment = (link: AppLink): link is SegmentLink => "param" in link;

function decode(value: string): string | null {
	try {
		return decodeURIComponent(value.replace(/\+/g, " "));
	} catch {
		return null;
	}
}

/** The allowed, valid keys of a query string (`a=1&b=2`); the first value of a key wins. */
function pickQuery(link: QueryLink, read: (key: string) => string | undefined) {
	const params: Record<string, string> = {};
	for (const [key, valid] of Object.entries(link.query)) {
		const value = read(key);
		if (value !== undefined && valid.test(value)) params[key] = value;
	}
	return params;
}

function parseQuery(query: string): Map<string, string> {
	const values = new Map<string, string>();
	for (const pair of query.split("&")) {
		const [rawKey = "", rawValue = ""] = pair.split("=", 2);
		const key = decode(rawKey);
		const value = decode(rawValue);
		if (key && value !== null && !values.has(key)) values.set(key, value);
	}
	return values;
}

export function createAppLinks(config: AppLinksConfig) {
	const schemes = config.schemes.map(escape).join("|");
	// https://<host>/, <scheme>:// (or :///), or the parsed path Expo Router hands over.
	const start = `^(?:https://${escape(config.host)}/|(?:${schemes}):///?|/)`;
	const matchers = config.links.map((link) => {
		const prefix = escape(isSegment(link) ? link.path.slice(1, -2) : link.path.slice(1));
		return {
			link,
			url: isSegment(link)
				? new RegExp(`${start}${prefix}/([^/?#]+)/?(?:[?#].*)?$`)
				: new RegExp(`${start}${prefix}/?(?:\\?([^#]*))?(?:#.*)?$`),
			// Expo Router's decoded pathname: no trailing slash, whole segment.
			pathname: isSegment(link) ? new RegExp(`^/${prefix}/([^/]*)$`) : new RegExp(`^/${prefix}$`),
			// Anything that starts like this link, valid or not.
			loose: new RegExp(`^(?:[a-z][a-z0-9+.-]*:)?/*${prefix}(?:[/?#]|$)`, "i"),
		};
	});

	/** The app route an incoming link opens, or `null` when it is not a claimed link. */
	function routeFromUrl(url: string): string | null {
		const trimmed = url.trim();
		for (const { link, url: re } of matchers) {
			const match = re.exec(trimmed);
			if (!match) continue;
			if (!isSegment(link)) {
				const values = parseQuery(match[1] ?? "");
				return link.route(pickQuery(link, (key) => values.get(key)));
			}
			const param = match[1];
			if (param !== undefined && link.param.test(param)) return link.route(param);
		}
		return null;
	}

	/**
	 * The route of the current app location, or `null`: `usePathname()` plus,
	 * for query links, `useGlobalSearchParams()`.
	 */
	function routeFromPathname(pathname: string, search: SearchParams = {}): string | null {
		for (const { link, pathname: re } of matchers) {
			const match = re.exec(pathname);
			if (!match) continue;
			if (!isSegment(link)) {
				return link.route(
					pickQuery(link, (key) => {
						const value = search[key];
						return Array.isArray(value) ? value[0] : value;
					}),
				);
			}
			const param = match[1];
			if (param !== undefined && link.param.test(param)) return link.route(param);
		}
		return null;
	}

	/**
	 * For `+native-intent.tsx`. A claimed link opens its route. Any other web
	 * link, and a malformed claimed link (`foundry://join//ABC`, which Expo
	 * Router would collapse into `/join/ABC`), opens the home route. Other
	 * app-scheme links (sign-in callbacks) pass through unchanged.
	 */
	function systemPath(path: string, home = "/"): string {
		const route = routeFromUrl(path);
		if (route) return route;
		if (/^https?:/i.test(path)) return home;
		if (matchers.some(({ loose }) => loose.test(path))) return home;
		return path;
	}

	return { routeFromUrl, routeFromPathname, systemPath };
}

/** `ios.associatedDomains` for a variant that claims links; `[]` otherwise. */
export function associatedDomains(host: string, claims: boolean): string[] {
	return claims ? [`applinks:${host}`, `webcredentials:${host}`] : [];
}

/**
 * The `apple-app-site-association` JSON. `appIDs` are `<TeamID>.<bundle ID>`,
 * Preview first: iOS follows `details` in order, so the owner's Preview build
 * opens links when both are installed, and users only ever have production.
 * A component path without a `?` key matches any query.
 */
export function buildAasa(appIDs: readonly string[], links: readonly AppLink[]) {
	const components = links.map((link) => ({ "/": link.path, comment: link.comment }));
	return {
		applinks: { details: appIDs.map((appID) => ({ appIDs: [appID], components })) },
		webcredentials: { apps: [...appIDs] },
	};
}
