import { defineConfig } from "@playwright/test";

// Browser smoke tests against a running Fairway (a PR preview or `pnpm dev`),
// signed in as the Clerk development test user. Not part of `pnpm verify` or CI:
// they need a live backend and that user's credentials. See docs/runbooks/development.md.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
	testDir: "e2e",
	outputDir: "test-results",
	timeout: 60_000,
	reporter: [["list"]],
	use: { baseURL, browserName: "chromium", trace: "retain-on-failure" },
	projects: [
		{ name: "sign-in", testMatch: /sign-in\.setup\.ts/ },
		{
			name: "desktop",
			dependencies: ["sign-in"],
			use: {
				viewport: { width: 1440, height: 900 },
				storageState: "e2e/.auth/user.json",
			},
		},
		{
			name: "phone",
			dependencies: ["sign-in"],
			use: {
				viewport: { width: 390, height: 844 },
				hasTouch: true,
				isMobile: true,
				storageState: "e2e/.auth/user.json",
			},
		},
	],
});
