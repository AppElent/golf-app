/**
 * Jest, and only inside `apps/mobile`. `jest-expo` is the only maintained preset
 * that transforms Flow-typed `node_modules` (`react-native`, every `expo-*`).
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
	"expo",
	"expo-.*",
	"jest-expo",
	"react-native",
	"react-native-.*",
].join("|");

module.exports = {
	preset: "jest-expo",
	setupFiles: ["<rootDir>/jest.setup.ts"],
	testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
	// Both separators: on Windows these patterns are tested against backslash paths.
	transformIgnorePatterns: [
		`node_modules[\\\\/](?!([^\\\\/]+[\\\\/])*(${mustTransform})[\\\\/])`,
	],
};
