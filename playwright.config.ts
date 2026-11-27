import { defineConfig } from "@playwright/test";

// Browser smoke tests against a running Fairway (a PR preview or `pnpm dev`),
// signed in as a Clerk development test user. Not part of `pnpm verify`: they
// need a live backend. CI runs them against each PR preview (preview.yml).
// See docs/runbooks/development.md.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
	testDir: "e2e",
	outputDir: "test-results",
	timeout: 60_000,
	reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
	use: {
		baseURL,
		browserName: "chromium",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{ name: "sign-in", testMatch: /sign-in\.setup\.ts/ },
		{
			// Signs in and out in a session of its own (no stored state).
			name: "sign-out",
			testMatch: /sign-out\.spec\.ts/,
			use: { viewport: { width: 390, height: 844 } },
		},
		{
			name: "desktop",
			dependencies: ["sign-in"],
			testIgnore: /sign-out\.spec\.ts/,
			use: {
				viewport: { width: 1440, height: 900 },
				storageState: "e2e/.auth/user.json",
			},
		},
		{
			name: "phone",
			dependencies: ["sign-in"],
			testIgnore: /sign-out\.spec\.ts/,
			use: {
				viewport: { width: 390, height: 844 },
				hasTouch: true,
				isMobile: true,
				storageState: "e2e/.auth/user.json",
			},
		},
	],
});
