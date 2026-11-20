// @vitest-environment node
// Runs in the root Vitest suite (`pnpm test`); vitest.config.ts excludes the
// rest of apps/mobile, which is Jest's.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
	fingerprintErrors,
	PLATFORMS,
	parseJson,
	WATCHED,
} from "./fingerprint.mjs";

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

describe("parseJson", () => {
	it("parses plain JSON", () => {
		expect(parseJson('{"hash":"a"}')).toEqual({ hash: "a" });
	});

	it("skips pnpm's install log and a [WARN] line before the JSON", () => {
		const stdout = [
			"Scope: all 3 workspace projects",
			" WARN  deprecated glob@7.2.3",
			"[WARN] Unsupported engine: wanted node ^22.13.0",
			'{"modules":[]}',
		].join("\n");
		expect(parseJson(stdout)).toEqual({ modules: [] });
	});

	it("still parses a top-level JSON array", () => {
		expect(parseJson('[WARN] something\n["a"]\n')).toEqual(["a"]);
	});

	it("throws when there is no JSON", () => {
		expect(() => parseJson("[WARN] only a warning\n")).toThrow(SyntaxError);
	});
});

describe("fingerprintErrors", () => {
	it.each(PLATFORMS)("passes a complete %s fingerprint", (platform) => {
		expect(fingerprintErrors("preview", platform, print(platform))).toEqual([]);
	});

	it.each(PLATFORMS)(
		"fails, not warns, when %s has no Expo-autolinked module",
		(platform) => {
			// The @expo/fingerprint 0.21.7 shape on Android (APP-71): the
			// autolinking source is gone, config plugins remain.
			const errors = fingerprintErrors(
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
		const errors = fingerprintErrors(
			"production",
			platform,
			print(platform, { without: [name] }),
		);
		expect(errors).toEqual([
			`production ${platform}: ${name} is not in the fingerprint`,
		]);
	});

	it("fails on Android when expo-application is missing and autolinking is gone", () => {
		const errors = fingerprintErrors(
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
		expect(fingerprintErrors("preview", "android", unhashed)).toEqual([
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
		expect(fingerprintErrors("preview", "ios", unhashed)).toEqual([
			"preview ios: expo-application is not in the fingerprint",
		]);
	});
});

describe("fingerprintErrors with the autolinked module list", () => {
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
				fingerprintErrors("preview", platform, full(platform), expected),
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
			expect(fingerprintErrors("preview", platform, lost, expected)).toEqual([
				`preview ${platform}: Expo-autolinked expo-sqlite is not in the fingerprint`,
			]);
		},
	);

	it("does not count an autolinked module whose source has no hash", () => {
		const unhashed = full("android");
		unhashed.sources = unhashed.sources.map((s) =>
			s.filePath?.includes("/expo-sqlite/") ? { ...s, hash: null } : s,
		);
		expect(fingerprintErrors("preview", "android", unhashed, expected)).toEqual(
			[
				"preview android: Expo-autolinked expo-sqlite is not in the fingerprint",
			],
		);
	});

	it("does not count a module that is only a config plugin", () => {
		const pluginOnly = full("ios");
		pluginOnly.sources = pluginOnly.sources.map((s) =>
			s.filePath?.includes("/expo-sqlite/")
				? { ...s, reasons: ["expoConfigPlugins"] }
				: s,
		);
		expect(fingerprintErrors("preview", "ios", pluginOnly, expected)).toEqual([
			"preview ios: Expo-autolinked expo-sqlite is not in the fingerprint",
		]);
	});

	it("reports a fingerprint without autolinking once, not per module", () => {
		expect(
			fingerprintErrors(
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
// Without APP_VARIANT the app config falls back to a local development build.
const variant = process.env.APP_VARIANT || "development";
const file = args.includes("fingerprint:generate")
	? \`fingerprint-\${variant}-\${platform}.json\`
	: \`autolinking-\${variant}-\${platform}.json\`;
if (process.env.FAIL_RESOLVE && !args.includes("fingerprint:generate")) {
	process.stderr.write("resolve failed");
	process.exit(1);
}
// pnpm logs this to stdout when it installs before running.
process.stdout.write("Scope: all 3 workspace projects\\n");
// Outside CI=true pnpm can print a warning line that starts with "[".
process.stdout.write("[WARN] Unsupported engine\\n");
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
	 * Runs `check` with fixtures. `modules(variant, platform)` is what
	 * autolinking resolves; `prints(variant, platform)` the fingerprint to
	 * report.
	 */
	function runCheck(modules, prints, env = {}) {
		const dir = mkdtempSync(join(tmpdir(), "fingerprint-check-"));
		dirs.push(dir);
		writeFileSync(join(dir, "pnpm"), FAKE_PNPM);
		chmodSync(join(dir, "pnpm"), 0o755);
		for (const platform of PLATFORMS) {
			for (const variant of VARIANTS) {
				const resolved = {
					modules: modules(variant, platform).map((packageName) => ({
						packageName,
					})),
				};
				writeFileSync(
					// The script must ask autolinking for `apple`, as @expo/fingerprint does.
					join(
						dir,
						`autolinking-${variant}-${platform === "ios" ? "apple" : platform}.json`,
					),
					JSON.stringify(resolved),
				);
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
				APP_VARIANT: "",
				FINGERPRINT_FIXTURES: dir,
				PATH: `${dir}${delimiter}${process.env.PATH}`,
				...env,
			},
		});
	}

	// expo-symbols links on iOS only, @sentry/react-native on Android only.
	// expo-dev-client links only in the development variant.
	const byPlatform = {
		ios: [...Object.keys(WATCHED), "expo-sqlite", "expo-symbols"],
		android: [...Object.keys(WATCHED), "expo-sqlite", "@sentry/react-native"],
	};
	const modules = (variant, platform) =>
		variant === "development"
			? [...byPlatform[platform], "expo-dev-client"]
			: byPlatform[platform];
	const healthy = (variant, platform) =>
		realPrint(platform, modules(variant, platform));

	it("exits 0 when every fingerprint has its platform's modules", () => {
		const result = runCheck(modules, healthy);
		expect(result.status).toBe(0);
		expect(result.stdout).not.toContain("::error::");
		expect(result.stdout).toContain(
			"Every fingerprint has every Expo-autolinked module",
		);
	});

	it("asks autolinking per variant, so each variant's modules are expected", () => {
		// A check that resolved autolinking without APP_VARIANT would get the
		// development list (with expo-dev-client) for every variant and fail
		// preview and production; one that used the preview list everywhere
		// would miss a development build losing expo-dev-client.
		expect(runCheck(modules, healthy).status).toBe(0);
		const result = runCheck(modules, (variant, platform) =>
			realPrint(platform, byPlatform[platform]),
		);
		expect(result.status).toBe(1);
		expect(
			result.stdout.split("\n").filter((line) => line.startsWith("::error::")),
		).toEqual(
			PLATFORMS.map(
				(platform) =>
					`::error::development ${platform}: Expo-autolinked expo-dev-client is not in the fingerprint`,
			),
		);
	});

	it("exits 1 when autolinking cannot be resolved", () => {
		const result = runCheck(modules, healthy, { FAIL_RESOLVE: "1" });
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("expo-modules-autolinking resolve failed");
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
						byPlatform.android.filter((name) => name !== "expo-sqlite"),
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
