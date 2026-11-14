// Copied from the platform-parity standard (AppElent/developer-home#2) with
// its rules unchanged (only Biome's formatting differs), and called from
// scripts/feature-manifest.test.ts. listRouteFiles lists route files under a
// route root, relative and without extension, skipping tests, layouts, and
// framework files. checkFeatureManifest returns one message per problem:
// an unmapped route, a stale pattern, a status that contradicts the
// platforms, a missing reason, or an exclusive floor feature or share target.
// Adjust only the ignore list; the rules come from the standard.
import fs from "node:fs";
import path from "node:path";

type Platform = "web" | "mobile";

interface ManifestFeature {
	readonly id: string;
	readonly kind: "floor" | "share-target" | "product";
	readonly status: "parity" | "exclusive" | "pending-port";
	readonly platforms: readonly Platform[];
	readonly reason?: string;
	readonly layout?: "responsive" | "large-screen";
	readonly layoutReason?: string;
	readonly routes: {
		readonly web?: readonly string[];
		readonly mobile?: readonly string[];
	};
}

const PLATFORMS: readonly Platform[] = ["web", "mobile"];

/** Files that are not screens: tests, layouts, generated trees, framework hooks. */
const IGNORED = [
	/(^|\/)__tests__\//,
	/\.(test|spec)$/,
	/(^|\/)-[^/]*$/, // TanStack Router ignores files that start with "-"
	/(^|\/)__root$/,
	/(^|\/)_[^/]*$/, // Expo _layout and TanStack pathless layouts (_app, _authed)
	/(^|\/)\+(html|not-found|native-intent)$/,
	/(^|\/)routeTree\.gen$/,
];

export function listRouteFiles(
	root: string,
	ignore: readonly RegExp[] = IGNORED,
): string[] {
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
				continue;
			}
			if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith(".d.ts")) continue;
			const route = path
				.relative(root, full)
				.split(path.sep)
				.join("/")
				.replace(/\.tsx?$/, "");
			if (!ignore.some((pattern) => pattern.test(route))) out.push(route);
		}
	};
	walk(root);
	return out.sort();
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
		if (platforms.length === 0 && status !== "pending-port")
			problems.push(`${id}: lists no platform`);
		if (status === "parity" && !both)
			problems.push(`${id}: status "parity" needs both platforms`);
		if (status !== "parity" && both)
			problems.push(`${id}: on both platforms, so status must be "parity"`);
		if (status !== "parity" && !feature.reason?.trim())
			problems.push(`${id}: status "${status}" needs a reason`);
		if (
			status === "exclusive" &&
			kind !== "product" &&
			!feature.reason?.includes("adr/")
		) {
			problems.push(
				`${id}: a ${kind} feature cannot be exclusive without linking the parity ADR in its reason`,
			);
		}
		if (feature.layout === "large-screen" && !feature.layoutReason?.trim()) {
			problems.push(`${id}: layout "large-screen" needs a layoutReason`);
		}
		if (feature.layout && !platforms.includes("web"))
			problems.push(`${id}: layout applies only to web features`);

		for (const platform of PLATFORMS) {
			const patterns = feature.routes[platform] ?? [];
			if (patterns.length > 0 && !platforms.includes(platform)) {
				problems.push(
					`${id}: has ${platform} routes but does not list ${platform}`,
				);
			}
			for (const glob of patterns) {
				const regex = routePattern(glob);
				if (!routes[platform].some((route) => regex.test(route))) {
					problems.push(
						`${id}: ${platform} pattern "${glob}" matches no route`,
					);
				}
			}
		}
	}

	for (const platform of PLATFORMS) {
		const patterns = features.flatMap((feature) =>
			(feature.routes[platform] ?? []).map(routePattern),
		);
		for (const route of routes[platform]) {
			if (!patterns.some((regex) => regex.test(route))) {
				problems.push(
					`${platform} route "${route}" belongs to no feature; add it to features.ts`,
				);
			}
		}
	}

	return problems;
}
