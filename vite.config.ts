import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The app's SemVer lives in one place, the phone's `app.json` (releases
 * standard); the web build reads the same value.
 */
const appVersion: string = JSON.parse(
	readFileSync(new URL("./apps/mobile/app.json", import.meta.url), "utf8"),
).expo.version;

function gitCommit(): string | undefined {
	if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], {
			encoding: "utf8",
		}).trim();
	} catch {
		return undefined;
	}
}

const commit = gitCommit();

/**
 * One release names the browser bundle, the Worker and their source maps:
 * `fairway@<version>+<short sha>`, what `/version` reports too.
 */
function sentryRelease(): string | undefined {
	if (process.env.SENTRY_RELEASE) return process.env.SENTRY_RELEASE;
	return commit ? `fairway@${appVersion}+${commit.slice(0, 7)}` : undefined;
}

const release = sentryRelease();
// Only deploying builds (deploy-web.yml, preview.yml) supply the token; without
// it the plugin uploads nothing.
// Never a VITE_ var.
const uploadToken = process.env.SENTRY_AUTH_TOKEN;

const config = defineConfig({
	define: {
		"import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(release),
		"import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
		"import.meta.env.VITE_GIT_COMMIT": JSON.stringify(commit),
		"import.meta.env.VITE_BUILT_AT": JSON.stringify(new Date().toISOString()),
	},
	// Hidden maps are uploaded, then scripts/remove-client-sourcemaps.mjs
	// deletes the public client copies before deploy.
	build: { sourcemap: "hidden" },
	plugins: [
		devtools(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		sentryVitePlugin({
			org: process.env.SENTRY_ORG || "appelent",
			project: process.env.SENTRY_PROJECT || "fairway",
			authToken: uploadToken,
			disable: !uploadToken,
			release: { name: release },
			sourcemaps: { assets: ["dist/**/*.js", "dist/**/*.map"] },
			telemetry: false,
		}),
	],
});

export default config;
