import { execFileSync } from "node:child_process";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** One release names the browser bundle, the Worker and their source maps. */
function sentryRelease(): string | undefined {
	if (process.env.SENTRY_RELEASE) return process.env.SENTRY_RELEASE;
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], {
			encoding: "utf8",
		}).trim();
	} catch {
		return undefined;
	}
}

const release = sentryRelease();
// Only deploying builds (deploy-web.yml, preview.yml) supply the token; without
// it the plugin uploads nothing.
// Never a VITE_ var.
const uploadToken = process.env.SENTRY_AUTH_TOKEN;

const config = defineConfig({
	define: {
		"import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(release),
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
