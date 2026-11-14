// From the mobile-baseline template (docs/standards/mobile-baseline/templates/
// fingerprint.mjs), extended with WATCHED and the `check` command.
//
// Runtime fingerprints: the value a build and an over-the-air update must
// share before the build loads the update. Computed locally, they match what
// EAS records on a build.
//
//   node apps/mobile/scripts/fingerprint.mjs              # this checkout, per variant
//   node apps/mobile/scripts/fingerprint.mjs diff <base>  # Markdown: what changed vs
//                                                         # another checkout (CI)
//   node apps/mobile/scripts/fingerprint.mjs check        # fails when a fingerprint misses
//                                                         # an Expo-autolinked module or a
//                                                         # WATCHED package
//
// `check` rule: for every variant and platform, each module that Expo
// autolinking resolves for it (`expo-modules-autolinking resolve --platform
// <apple|android>` with that APP_VARIANT, the list the native build links and
// @expo/fingerprint hashes) must have a hashed source under
// `node_modules/<package>/` with the platform's autolinking reason. The
// expected set is per platform, so a module that only links on iOS
// (expo-symbols) or only on Android (@sentry/react-native's Expo package) is
// never expected on the other one. A fingerprint with no autolinked module at
// all gets one error instead of one per module. Every WATCHED package must
// also have a hashed source. A local Expo module (`modules/<name>`) or a
// workspace package has no `node_modules/` path and would be reported
// missing; teach `sourceKey` its path before adding one (none today).
//
// `diff` needs `<base>` installed (`pnpm install`), because native modules
// are fingerprinted from node_modules.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const VARIANTS = ["preview", "production", "development"];
export const PLATFORMS = ["ios", "android"];

/**
 * Native packages behind a runtime behaviour installed builds rely on. `check`
 * fails when one drops out of any variant's or platform's fingerprint (no
 * longer a config plugin or autolinked module), and `diff` lists their version
 * changes, so a bump that changes what installed builds do is named on the
 * PR, not only hashed.
 */
export const WATCHED = {
	"@clerk/expo":
		"Clerk SDK. From 4.15.0 it enforces the Clerk Dashboard's minimum app version and can show an Update required screen.",
	"expo-application":
		"Gives Clerk the build's bundle ID and version for that check. Without it the check always reports supported.",
};

/** `{ hash, sources }` for one variant and platform of the app at `root`. */
export function fingerprint(variant, platform, root = appRoot) {
	const result = spawnSync(
		"pnpm",
		["exec", "expo-updates", "fingerprint:generate", "--platform", platform],
		{
			cwd: root,
			env: { ...process.env, APP_VARIANT: variant },
			encoding: "utf8",
			maxBuffer: 64 * 1024 * 1024,
		},
	);
	if (result.status !== 0) {
		throw new Error(
			`fingerprint:generate failed in ${root} (${variant}, ${platform}):\n${result.stderr}`,
		);
	}
	return parseJson(result.stdout);
}

/**
 * JSON printed by a `pnpm exec` command. Skips anything pnpm prints before
 * it (when it installs first, it logs `Scope: …` to stdout).
 */
function parseJson(stdout) {
	const start = stdout.search(/^[{[]/m);
	return JSON.parse(start === -1 ? stdout : stdout.slice(start));
}

/** The `--platform` autolinking and @expo/fingerprint use for iOS modules. */
const AUTOLINKING_PLATFORM = { ios: "apple", android: "android" };

/**
 * Package names Expo autolinking links for one variant and platform of the
 * app at `root`: the modules that fingerprint must contain.
 */
export function autolinkedModules(variant, platform, root = appRoot) {
	const result = spawnSync(
		"pnpm",
		[
			"exec",
			"expo-modules-autolinking",
			"resolve",
			"--platform",
			AUTOLINKING_PLATFORM[platform],
			"--json",
		],
		{
			cwd: root,
			env: { ...process.env, APP_VARIANT: variant },
			encoding: "utf8",
			maxBuffer: 64 * 1024 * 1024,
		},
	);
	if (result.status !== 0) {
		throw new Error(
			`expo-modules-autolinking resolve failed in ${root} (${variant}, ${platform}):\n${result.stderr}`,
		);
	}
	return parseJson(result.stdout).modules.map((m) => m.packageName);
}

/** Readable id: pnpm's store path shortened to `node_modules/<package>/…`. */
function sourceKey(source) {
	return source.type === "contents"
		? source.id
		: source.filePath.replace(/^.*node_modules\//, "node_modules/");
}

/** The source reason @expo/fingerprint gives Expo-autolinked modules, per platform. */
const AUTOLINKING_REASON = {
	ios: "expoAutolinkingIos",
	android: "expoAutolinkingAndroid",
};

/** Source keys (`node_modules/<package>/…`) that belong to `name`. */
function sourcesOf(print, name) {
	const prefix = `node_modules/${name}/`;
	return print.sources
		.filter((s) => s.hash !== null)
		.map(sourceKey)
		.filter((key) => key.startsWith(prefix));
}

/** The version `name` resolves to from the app at `root`, or null. */
function installedVersion(name, root = appRoot) {
	try {
		const require = createRequire(join(root, "package.json"));
		return require(`${name}/package.json`).version;
	} catch {
		return null;
	}
}

/**
 * Error lines for one fingerprint: an `expected` autolinked module (see
 * `autolinkedModules`) without a hashed autolinking source, no autolinked
 * module at all, or a WATCHED package missing. No platform or package is
 * exempt. This catches @expo/fingerprint dropping a platform's autolinking
 * sources, as 0.21.7 did for every module on Android when expo-widgets
 * declared a gradle plugin published to Maven (no `sourceDir`; APP-71), and
 * the same failure for a single module. An update could then reach builds
 * without the native code it needs.
 */
export function fingerprintErrors(variant, platform, print, expected = []) {
	const errors = [];
	const reason = AUTOLINKING_REASON[platform];
	const autolinked = print.sources.filter(
		(s) => s.hash !== null && s.reasons.includes(reason),
	);
	if (autolinked.length === 0) {
		errors.push(
			`${variant} ${platform}: no Expo-autolinked module is in the fingerprint`,
		);
	} else {
		const keys = autolinked.filter((s) => s.type !== "contents").map(sourceKey);
		for (const name of expected) {
			if (!keys.some((key) => key.startsWith(`node_modules/${name}/`))) {
				errors.push(
					`${variant} ${platform}: Expo-autolinked ${name} is not in the fingerprint`,
				);
			}
		}
	}
	for (const name of Object.keys(WATCHED)) {
		if (sourcesOf(print, name).length === 0) {
			errors.push(`${variant} ${platform}: ${name} is not in the fingerprint`);
		}
	}
	return errors;
}

function check() {
	const errors = [];
	for (const variant of VARIANTS) {
		for (const platform of PLATFORMS) {
			errors.push(
				...fingerprintErrors(
					variant,
					platform,
					fingerprint(variant, platform),
					autolinkedModules(variant, platform),
				),
			);
		}
	}
	for (const name of Object.keys(WATCHED)) {
		console.log(
			`${name.padEnd(18)} ${installedVersion(name) ?? "not installed"}`,
		);
	}
	if (errors.length > 0) {
		for (const line of errors) console.log(`::error::${line}`);
		return false;
	}
	console.log(
		"Every fingerprint has every Expo-autolinked module and every watched package.",
	);
	return true;
}

/** Markdown rows for WATCHED packages whose version differs from `baseApp`. */
function watchedChanges(baseApp) {
	return Object.entries(WATCHED).flatMap(([name, why]) => {
		const before = installedVersion(name, baseApp);
		const after = installedVersion(name);
		if (before === after) return [];
		const show = (v) => v ?? "not a direct dependency";
		return [`| \`${name}\` | ${show(before)} | ${show(after)} | ${why} |`];
	});
}

/**
 * Source keys whose hash differs, or that exist on one side only. Sources
 * without a hash (an ignored local `ios/` folder) don't count.
 */
function changedSources(before, after) {
	const hashed = (print) => print.sources.filter((s) => s.hash !== null);
	const hashes = new Map(hashed(before).map((s) => [sourceKey(s), s.hash]));
	const changed = new Set();
	for (const source of hashed(after)) {
		const key = sourceKey(source);
		if (hashes.get(key) !== source.hash) changed.add(key);
		hashes.delete(key);
	}
	for (const key of hashes.keys()) changed.add(key);
	return changed;
}

function diff(baseRepo) {
	const repoRoot = spawnSync("git", ["rev-parse", "--show-toplevel"], {
		cwd: appRoot,
		encoding: "utf8",
	}).stdout.trim();
	const baseApp = join(resolve(baseRepo), relative(repoRoot, appRoot));
	if (!existsSync(join(baseApp, "package.json"))) {
		return "### Mobile runtime\n\nThe base branch has no mobile app yet; every build is new.";
	}
	const rows = [];
	const sources = new Set();
	for (const variant of VARIANTS) {
		const cells = PLATFORMS.map((platform) => {
			const before = fingerprint(variant, platform, baseApp);
			const after = fingerprint(variant, platform);
			if (before.hash === after.hash) return "same";
			for (const key of changedSources(before, after)) sources.add(key);
			return "**new runtime**";
		});
		rows.push(`| ${variant} | ${cells.join(" | ")} |`);
	}
	const native = sources.size > 0;
	const lines = [
		"### Mobile runtime",
		"",
		native
			? "This PR changes native code or config. Installed builds won't load its JS as an update: after merging, build `preview-internal` (and production when releasing)."
			: "No native changes. Installed builds can take this PR as an over-the-air update (`pnpm mobile:update:preview`).",
		"",
		"| Variant | iOS | Android |",
		"| --- | --- | --- |",
		...rows,
	];
	const watched = watchedChanges(baseApp);
	if (watched.length > 0) {
		lines.push(
			"",
			"#### Watched native packages",
			"",
			"| Package | Base | PR | Why it matters |",
			"| --- | --- | --- | --- |",
			...watched,
		);
	}
	if (native) {
		lines.push(
			"",
			"<details><summary>Changed fingerprint sources</summary>",
			"",
			...[...sources].sort().map((key) => `- \`${key}\``),
			"",
			"</details>",
		);
	}
	return lines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [command, base] = process.argv.slice(2);
	if (command === "diff" && base) {
		console.log(diff(base));
	} else if (command === "check") {
		if (!check()) process.exit(1);
	} else if (!command) {
		for (const variant of VARIANTS) {
			const hashes = PLATFORMS.map(
				(platform) => `${platform} ${fingerprint(variant, platform).hash}`,
			);
			console.log(`${variant.padEnd(12)} ${hashes.join("  ")}`);
		}
	} else {
		console.error("Usage: fingerprint.mjs [check | diff <base checkout>]");
		process.exit(1);
	}
}
