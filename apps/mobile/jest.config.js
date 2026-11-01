/**
 * Jest, and only inside `apps/mobile`.
 *
 * The repo runs Vitest everywhere else and keeps doing so — this config does
 * not touch the root `vitest run`. The reason for the exception is that the
 * hard part of testing React Native is transforming Flow-typed `node_modules`
 * (`react-native`, every `expo-*`) and supplying the native-module mocks.
 * `jest-expo` is the only maintained preset that does both, and
 * `expo-router/testing-library` — the seam that mounts a real route by path —
 * is written against Jest's globals and `jest.mock`. Vitest can be made to work
 * and would have to be re-argued at every Expo upgrade.
 *
 * `transformIgnorePatterns` is the fiddly part under pnpm. Packages do not live
 * at `node_modules/<name>` but at `node_modules/.pnpm/<name>@<version>/node_modules/<name>`,
 * so the usual `node_modules/(?!expo|react-native|…)` allow-list matches at the
 * *first* `node_modules/` — where the next segment is `.pnpm` — and refuses to
 * transform anything. Matching the package name anywhere in the path instead is
 * what makes the Flow-typed Expo packages transformable here.
 */

/** Everything whose source Jest must run through Babel rather than `require` raw. */
const mustTransform = [
	"@expo",
	"@react-native",
	"@react-navigation",
	"@testing-library",
	"convex-helpers",
	"expo",
	"expo-.*",
	"jest-expo",
	"react-native",
	"react-native-.*",
	"standard-navigation",
].join("|");

module.exports = {
	preset: "jest-expo",
	setupFiles: [
		require.resolve("react-native-gesture-handler/jestSetup"),
		"<rootDir>/jest.setup.ts",
	],
	// Reanimated 4.7 / Worklets 0.13 (SDK 58) load JSI-only `.native` builds
	// unless Jest resolves their test entry points through Reanimated's resolver.
	resolver: require.resolve("react-native-reanimated/jest/resolver"),
	testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
	// Both separators everywhere: on Windows these patterns are tested against
	// backslash paths, and a `node_modules/` written with a forward slash alone
	// matches nothing there — so every package is left untransformed and the
	// first Flow-typed import throws.
	transformIgnorePatterns: [
		`node_modules[\\\\/](?!([^\\\\/]+[\\\\/])*(${mustTransform})[\\\\/])`,
	],
};
