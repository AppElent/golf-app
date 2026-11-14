// @vitest-environment node
// Runs in the root Vitest suite (`pnpm test`); vitest.config.ts excludes the
// rest of apps/mobile, which is Jest's.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { missingWatched, PLATFORMS, WATCHED } from "./fingerprint.mjs";

const REASON = { ios: "expoAutolinkingIos", android: "expoAutolinkingAndroid" };

/** A source as @expo/fingerprint reports it, from pnpm's store. */
function moduleSource(name, platform, reason, hash = "abc") {
	return {
		type: "dir",
		filePath: `node_modules/.pnpm/${name}@1.0.0/node_modules/${name}/${platform}`,
		reasons: [reason],
		hash,
	};
}

/** A fingerprint holding every WATCHED package except `without`. */
function print(platform, { without = [], autolinking = true } = {}) {
	const reason = autolinking ? REASON[platform] : "expoConfigPlugins";
	return {
		sources: [
			{
				type: "contents",
				id: "expoConfig",
				contents: "{}",
				reasons: ["expoConfig"],
				hash: "c",
			},
			...Object.keys(WATCHED)
				.filter((name) => !without.includes(name))
				.map((name) => moduleSource(name, platform, reason)),
		],
	};
}

describe("missingWatched", () => {
	it.each(PLATFORMS)("passes a complete %s fingerprint", (platform) => {
		expect(missingWatched("preview", platform, print(platform))).toEqual([]);
	});

	it.each(PLATFORMS)(
		"fails, not warns, when %s has no Expo-autolinked module",
		(platform) => {
			// The @expo/fingerprint 0.21.7 shape on Android (APP-71): the
			// autolinking source is gone, config plugins remain.
			const errors = missingWatched(
				"preview",
				platform,
				print(platform, { autolinking: false }),
			);
			expect(errors).toEqual([
				`preview ${platform}: no Expo-autolinked module is in the fingerprint`,
			]);
		},
	);

	it.each(
		PLATFORMS.flatMap((platform) =>
			Object.keys(WATCHED).map((name) => [platform, name]),
		),
	)("fails on %s when %s is missing", (platform, name) => {
		const errors = missingWatched(
			"production",
			platform,
			print(platform, { without: [name] }),
		);
		expect(errors).toEqual([
			`production ${platform}: ${name} is not in the fingerprint`,
		]);
	});

	it("fails on Android when expo-application is missing and autolinking is gone", () => {
		const errors = missingWatched(
			"preview",
			"android",
			print("android", { without: ["expo-application"], autolinking: false }),
		);
		expect(errors).toEqual([
			"preview android: no Expo-autolinked module is in the fingerprint",
			"preview android: expo-application is not in the fingerprint",
		]);
	});

	it("does not count autolinking sources without a hash", () => {
		const unhashed = print("android");
		unhashed.sources = unhashed.sources.map((s) =>
			s.reasons.includes("expoAutolinkingAndroid") ? { ...s, hash: null } : s,
		);
		expect(missingWatched("preview", "android", unhashed)).toEqual([
			"preview android: no Expo-autolinked module is in the fingerprint",
			...Object.keys(WATCHED).map(
				(name) => `preview android: ${name} is not in the fingerprint`,
			),
		]);
	});

	it("does not count a source without a hash", () => {
		const unhashed = print("ios");
		unhashed.sources = unhashed.sources.map((s) =>
			s.filePath?.includes("/expo-application/") ? { ...s, hash: null } : s,
		);
		expect(missingWatched("preview", "ios", unhashed)).toEqual([
			"preview ios: expo-application is not in the fingerprint",
		]);
	});
});

describe("missingWatched with the autolinked module list", () => {
	const expected = [...Object.keys(WATCHED), "expo-sqlite"];

	/** A complete fingerprint that also holds expo-sqlite. */
	function full(platform) {
		const complete = print(platform);
		complete.sources.push(
			moduleSource("expo-sqlite", platform, REASON[platform]),
		);
		return complete;
	}

	it.each(PLATFORMS)(
		"passes when every %s module is fingerprinted",
		(platform) => {
			expect(
				missingWatched("preview", platform, full(platform), expected),
			).toEqual([]);
		},
	);

	it.each(PLATFORMS)(
		"fails when %s loses one autolinked module",
		(platform) => {
			const lost = full(platform);
			lost.sources = lost.sources.filter(
				(s) => !s.filePath?.includes("/expo-sqlite/"),
			);
			expect(missingWatched("preview", platform, lost, expected)).toEqual([
				`preview ${platform}: Expo-autolinked expo-sqlite is not in the fingerprint`,
			]);
		},
	);

	it("does not count an autolinked module whose source has no hash", () => {
		const unhashed = full("android");
		unhashed.sources = unhashed.sources.map((s) =>
			s.filePath?.includes("/expo-sqlite/") ? { ...s, hash: null } : s,
		);
		expect(missingWatched("preview", "android", unhashed, expected)).toEqual([
			"preview android: Expo-autolinked expo-sqlite is not in the fingerprint",
		]);
	});

	it("does not count a module that is only a config plugin", () => {
		const pluginOnly = full("ios");
		pluginOnly.sources = pluginOnly.sources.map((s) =>
			s.filePath?.includes("/expo-sqlite/")
				? { ...s, reasons: ["expoConfigPlugins"] }
				: s,
		);
		expect(missingWatched("preview", "ios", pluginOnly, expected)).toEqual([
			"preview ios: Expo-autolinked expo-sqlite is not in the fingerprint",
		]);
	});

	it("reports a fingerprint without autolinking once, not per module", () => {
		expect(
			missingWatched(
				"preview",
				"android",
				print("android", { autolinking: false }),
				expected,
			),
		).toEqual([
			"preview android: no Expo-autolinked module is in the fingerprint",
		]);
	});
});

// `check` end to end: a stand-in `pnpm` first on PATH answers the script's two
// calls (`expo-updates fingerprint:generate` and `expo-modules-autolinking
// resolve`) from fixture JSON, so no native build or network is involved.
describe("fingerprint.mjs check", () => {
	const script = fileURLToPath(new URL("./fingerprint.mjs", import.meta.url));
	const FAKE_PNPM = `#!/usr/bin/env node
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const args = process.argv.slice(2);
const platform = args[args.indexOf("--platform") + 1];
const file = args.includes("fingerprint:generate")
	? \`fingerprint-\${process.env.APP_VARIANT}-\${platform}.json\`
	: \`autolinking-\${platform}.json\`;
process.stdout.write(readFileSync(join(process.env.FINGERPRINT_FIXTURES, file), "utf8"));
`;
	const VARIANTS = ["preview", "production", "development"];
	const dirs = [];

	afterEach(() => {
		for (const dir of dirs.splice(0))
			rmSync(dir, { recursive: true, force: true });
	});

	/** Real-shaped fingerprint: `package` sources plus the autolinking config. */
	function realPrint(platform, modules) {
		return {
			hash: `hash-${platform}`,
			sources: [
				{
					type: "contents",
					id: `expoAutolinkingConfig:${platform}`,
					contents: "{}",
					reasons: [REASON[platform]],
					hash: "cfg",
				},
				...modules.map((name) => ({
					type: "file",
					filePath: `../../node_modules/.pnpm/${name}@1.0.0/node_modules/${name}/package.json`,
					reasons: [REASON[platform], "expoConfigPlugins"],
					hash: `h-${name}`,
				})),
			],
		};
	}

	/**
	 * Runs `check` with fixtures. `modules[platform]` is what autolinking
	 * resolves; `prints(variant, platform)` the fingerprint to report.
	 */
	function runCheck(modules, prints) {
		const dir = mkdtempSync(join(tmpdir(), "fingerprint-check-"));
		dirs.push(dir);
		writeFileSync(join(dir, "pnpm"), FAKE_PNPM);
		chmodSync(join(dir, "pnpm"), 0o755);
		for (const platform of PLATFORMS) {
			const resolved = {
				modules: modules[platform].map((packageName) => ({ packageName })),
			};
			writeFileSync(
				join(dir, `autolinking-${platform}.json`),
				JSON.stringify(resolved),
			);
			for (const variant of VARIANTS) {
				writeFileSync(
					join(dir, `fingerprint-${variant}-${platform}.json`),
					JSON.stringify(prints(variant, platform)),
				);
			}
		}
		return spawnSync(process.execPath, [script, "check"], {
			encoding: "utf8",
			env: {
				...process.env,
				FINGERPRINT_FIXTURES: dir,
				PATH: `${dir}${delimiter}${process.env.PATH}`,
			},
		});
	}

	// expo-symbols links on iOS only, @sentry/react-native on Android only.
	const modules = {
		ios: [...Object.keys(WATCHED), "expo-sqlite", "expo-symbols"],
		android: [...Object.keys(WATCHED), "expo-sqlite", "@sentry/react-native"],
	};
	const healthy = (_variant, platform) =>
		realPrint(platform, modules[platform]);

	it("exits 0 when every fingerprint has its platform's modules", () => {
		const result = runCheck(modules, healthy);
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
		expect(result.stdout).not.toContain("::error::");
	});

	it("exits 1 for the APP-71 Android shape: no autolinked module, config plugins kept", () => {
		const result = runCheck(modules, (variant, platform) => {
			const real = healthy(variant, platform);
			if (platform !== "android") return real;
			// Only config plugins remain; expo-application is not one.
			return {
				...real,
				sources: real.sources
					.filter(
						(s) =>
							s.type !== "contents" &&
							!s.filePath.includes("/expo-application/"),
					)
					.map((s) => ({ ...s, reasons: ["expoConfigPlugins"] })),
			};
		});
		expect(result.status).toBe(1);
		const errors = result.stdout
			.split("\n")
			.filter((line) => line.startsWith("::error::"));
		expect(errors).toEqual(
			VARIANTS.flatMap((variant) => [
				`::error::${variant} android: no Expo-autolinked module is in the fingerprint`,
				`::error::${variant} android: expo-application is not in the fingerprint`,
			]),
		);
	});

	it("exits 1 when one variant loses a single autolinked module", () => {
		const result = runCheck(modules, (variant, platform) =>
			variant === "production" && platform === "android"
				? realPrint(
						platform,
						modules.android.filter((name) => name !== "expo-sqlite"),
					)
				: healthy(variant, platform),
		);
		expect(result.status).toBe(1);
		expect(
			result.stdout.split("\n").filter((line) => line.startsWith("::error::")),
		).toEqual([
			"::error::production android: Expo-autolinked expo-sqlite is not in the fingerprint",
		]);
	});
});
