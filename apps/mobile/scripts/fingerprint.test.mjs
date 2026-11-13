// @vitest-environment node
// Runs in the root Vitest suite (`pnpm test`); vitest.config.ts excludes the
// rest of apps/mobile, which is Jest's.
import { describe, expect, it } from "vitest";
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
			{ type: "contents", id: "expoConfig", contents: "{}", reasons: ["expoConfig"], hash: "c" },
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

	it.each(PLATFORMS)("fails, not warns, when %s has no Expo-autolinked module", (platform) => {
		// The @expo/fingerprint 0.21.7 shape on Android (APP-71): the
		// autolinking source is gone, config plugins remain.
		const errors = missingWatched("preview", platform, print(platform, { autolinking: false }));
		expect(errors).toEqual([`preview ${platform}: no Expo-autolinked module is in the fingerprint`]);
	});

	it.each(
		PLATFORMS.flatMap((platform) => Object.keys(WATCHED).map((name) => [platform, name])),
	)("fails on %s when %s is missing", (platform, name) => {
		const errors = missingWatched("production", platform, print(platform, { without: [name] }));
		expect(errors).toEqual([`production ${platform}: ${name} is not in the fingerprint`]);
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
			...Object.keys(WATCHED).map((name) => `preview android: ${name} is not in the fingerprint`),
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
