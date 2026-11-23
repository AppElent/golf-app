// The platform-parity standard's checker. Source of truth:
// developer-home standards/platform-parity/examples/feature-manifest-check.ts;
// apps copy it to scripts/feature-manifest-check.ts unchanged and call it from
// scripts/feature-manifest.test.ts (see the standard). Change it upstream
// first. listRouteFiles lists route files under a route root for one
// platform, relative and without extension, skipping layouts and files the
// router does not load. Web pathless layouts (`_app`) are skipped; a mobile
// `_foo` screen is not. checkFeatureManifest returns one message per problem:
// an unmapped route, a route owned by two features, a stale pattern, a status
// that contradicts the platforms, a missing reason, or an exclusive floor
// feature or share target. findBroadPatterns lists patterns that would take
// in a new screen without anyone deciding its feature.
import fs from "node:fs";
import path from "node:path";

type Platform = "web" | "mobile";

interface ManifestFeature {
	readonly id: string;
	readonly kind: "floor" | "share-target" | "product";
	readonly status: "parity" | "exclusive" | "pending-port";
	readonly platforms: readonly Platform[];
	/** pending-port only: the platforms the feature is meant for. Defaults to both. */
	readonly targetPlatforms?: readonly Platform[];
	readonly reason?: string;
	readonly layout?: "responsive" | "large-screen";
	readonly layoutReason?: string;
	readonly routes: { readonly web?: readonly string[]; readonly mobile?: readonly string[] };
}

const PLATFORMS: readonly Platform[] = ["web", "mobile"];

/** Extensions both routers load as routes (TanStack Router and Expo Router). */
const ROUTE_EXTENSION = /\.(?:ts|tsx|js|jsx)$/;

/**
 * Suffixes that are part of another route file, folded into it: TanStack's
 * code-split halves (`foo.lazy.tsx`, `foo.component.tsx`, `foo/lazy.tsx` next
 * to `foo/route.tsx`) and Expo Router's native variants (`index.ios.tsx`).
 * A native variant counts as the whole mobile route: the standard has one
 * mobile platform, so an iOS-only screen still counts for Android.
 */
const FOLDED: Readonly<Record<Platform, readonly [RegExp, string][]>> = {
	web: [
		[/\.(?:lazy|component|errorComponent|pendingComponent|notFoundComponent|loader)$/, ""],
		[/(^|\/)lazy$/, "$1route"],
	],
	mobile: [[/\.(?:ios|android|native)$/, ""]],
};

/**
 * Files that are not a screen: the root route, files the router skips, and
 * Expo layout and framework files. Expo renders `+not-found` as a screen, so
 * it must belong to a feature. Tests and `.d.ts` files are not in this list:
 * Expo loads them as routes and TanStack only warns, so one under a route
 * root fails the check. A mobile `.web` file is skipped because the app ships
 * only iOS and Android. TanStack's `routeFilePrefix` and
 * `routeFileIgnorePattern` options are not read: pass a matching `ignore`
 * list when the app sets them.
 */
const IGNORED: Readonly<Record<Platform, readonly RegExp[]>> = {
	web: [
		/(^|\/)-/, // TanStack Router ignores files and folders that start with "-"
		/(^|\/)\./, // and dotfiles
		/^__root$/, // only the root-level `__root` is the root route
	],
	mobile: [
		/\.web$/,
		/(^|\/)_layout$/,
		/^_sitemap$/,
		/(^|\/)\+(html|native-intent|middleware)$/,
		/\+api$/, // API routes run on the server, not as a screen
	],
};

/**
 * A TanStack pathless layout adds no URL segment: its last token starts with
 * `_`, whether nested (`_app/_authed`), flat (`_app._authed`), or a directory
 * route (`_app/_authed/route`). `_app._authed.unlisted` is a screen.
 */
function isWebPathlessLayout(route: string): boolean {
	const tokens = route
		.replace(/\[[^\]]*\]/g, "x") // `[.]well-known` escapes a literal dot
		.split(/[/.]/);
	if (tokens.at(-1) === "route") tokens.pop();
	const last = tokens.at(-1) ?? "";
	return last !== "__root" && last.startsWith("_"); // a nested `__root` is a route
}

/**
 * Lists the route files under `root`. A relative `root` resolves against the
 * current directory; tests should pass an absolute path. Symlinked folders and
 * files are followed, each real folder once.
 */
export function listRouteFiles(
	root: string,
	platform: Platform,
	ignore: readonly RegExp[] = IGNORED[platform],
): string[] {
	const out = new Set<string>();
	const visited = new Set<string>();
	const walk = (dir: string) => {
		const real = fs.realpathSync(dir);
		if (visited.has(real)) return;
		visited.add(real);
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			const isDirectory = entry.isSymbolicLink() ? fs.statSync(full).isDirectory() : entry.isDirectory();
			if (isDirectory) {
				walk(full);
				continue;
			}
			if (!ROUTE_EXTENSION.test(entry.name)) continue;
			let route = path.relative(root, full).split(path.sep).join("/").replace(ROUTE_EXTENSION, "");
			if (ignore.some((pattern) => pattern.test(route))) continue;
			for (const [suffix, replacement] of FOLDED[platform]) route = route.replace(suffix, replacement);
			if (ignore.some((pattern) => pattern.test(route))) continue;
			if (platform === "web" && isWebPathlessLayout(route)) continue;
			out.add(route);
		}
	};
	walk(root);
	return [...out].sort();
}

/** `*` matches within one segment, `**` across segments; everything else is literal. */
export function routePattern(glob: string): RegExp {
	let source = "";
	for (let i = 0; i < glob.length; i++) {
		const char = glob[i];
		if (char === "*" && glob[i + 1] === "*") {
			const slash = glob[i + 2] === "/";
			source += slash ? "(?:.*/)?" : ".*";
			i += slash ? 2 : 1;
		} else if (char === "*") {
			source += "[^/]*";
		} else {
			source += char.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
		}
	}
	return new RegExp(`^${source}$`);
}

export function checkFeatureManifest(
	features: readonly ManifestFeature[],
	routes: Readonly<Record<Platform, readonly string[]>>,
): string[] {
	const problems: string[] = [];
	const seen = new Set<string>();

	for (const feature of features) {
		const { id, kind, status, platforms } = feature;
		if (seen.has(id)) problems.push(`${id}: duplicate id`);
		seen.add(id);

		const both = PLATFORMS.every((platform) => platforms.includes(platform));
		const targets = feature.targetPlatforms ?? PLATFORMS;
		if (platforms.length === 0 && status !== "pending-port") problems.push(`${id}: lists no platform`);
		if (status === "parity" && !both) problems.push(`${id}: status "parity" needs both platforms`);
		if (status !== "parity" && both) problems.push(`${id}: on both platforms, so status must be "parity"`);
		if (status !== "parity" && !feature.reason?.trim()) problems.push(`${id}: status "${status}" needs a reason`);
		if (status === "exclusive" && kind !== "product" && !feature.reason?.includes("adr/")) {
			problems.push(`${id}: a ${kind} feature cannot be exclusive without linking the parity ADR in its reason`);
		}
		if (feature.targetPlatforms) {
			if (status !== "pending-port") problems.push(`${id}: targetPlatforms applies only to status "pending-port"`);
			if (targets.length === 0) problems.push(`${id}: targetPlatforms lists no platform`);
			if (targets.length < PLATFORMS.length && kind !== "product" && !feature.reason?.includes("adr/")) {
				problems.push(`${id}: a ${kind} feature cannot target one platform without linking the parity ADR in its reason`);
			}
		}
		if (status === "pending-port") {
			const missing = platforms.filter((platform) => !targets.includes(platform));
			if (missing.length > 0) problems.push(`${id}: ships on ${missing.join(", ")}, which targetPlatforms leaves out`);
			else if (!both && targets.every((platform) => platforms.includes(platform))) {
				problems.push(`${id}: already on every target platform, so status cannot be "pending-port"`);
			}
		}
		if (feature.layout === "large-screen" && !feature.layoutReason?.trim()) {
			problems.push(`${id}: layout "large-screen" needs a layoutReason`);
		}
		if (feature.layout && !platforms.includes("web")) problems.push(`${id}: layout applies only to web features`);

		for (const platform of PLATFORMS) {
			const patterns = feature.routes[platform] ?? [];
			if (patterns.length > 0 && !platforms.includes(platform)) {
				problems.push(`${id}: has ${platform} routes but does not list ${platform}`);
			}
			for (const glob of patterns) {
				const regex = routePattern(glob);
				if (!routes[platform].some((route) => regex.test(route))) {
					problems.push(`${id}: ${platform} pattern "${glob}" matches no route`);
				}
			}
		}
	}

	for (const platform of PLATFORMS) {
		const owners = features.map((feature) => ({
			id: feature.id,
			patterns: (feature.routes[platform] ?? []).map(routePattern),
		}));
		for (const route of routes[platform]) {
			const ids = owners.filter((owner) => owner.patterns.some((regex) => regex.test(route))).map((owner) => owner.id);
			if (ids.length === 0) {
				problems.push(`${platform} route "${route}" belongs to no feature; add it to features.ts`);
			} else if (ids.length > 1) {
				problems.push(`${platform} route "${route}" belongs to ${ids.length} features (${ids.join(", ")}); keep it in one`);
			}
		}
	}

	return problems;
}

/**
 * A pattern is broad when it can take in a screen nobody has placed yet: `**`,
 * or `*` next to other characters in one segment (`nutrition-*`). A whole
 * segment `*` under a folder the feature owns (`exercise/*`) is not broad.
 * These are warnings: list the routes instead when the folder is shared.
 */
export function findBroadPatterns(features: readonly ManifestFeature[]): string[] {
	const warnings: string[] = [];
	for (const feature of features) {
		for (const platform of PLATFORMS) {
			for (const glob of feature.routes[platform] ?? []) {
				const broad = glob.includes("**") || glob.split("/").some((segment) => segment.includes("*") && segment !== "*");
				if (broad) {
					warnings.push(`${feature.id}: ${platform} pattern "${glob}" is broad; a new screen it matches joins this feature without a prompt`);
				}
			}
		}
	}
	return warnings;
}
