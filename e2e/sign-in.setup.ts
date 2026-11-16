import { expect, test as setup } from "@playwright/test";

// Signs in once through Clerk's <SignIn> card and saves the session for the
// desktop and phone projects. Use the development instance's test user.
setup("sign in", async ({ page }) => {
	const email = process.env.E2E_USER_EMAIL;
	const password = process.env.E2E_USER_PASSWORD;
	if (!email || !password) {
		throw new Error(
			"Set E2E_USER_EMAIL and E2E_USER_PASSWORD (Clerk test user).",
		);
	}
	await page.goto("/");
	await page.getByLabel(/email address/i).fill(email);
	await page.getByRole("button", { name: "Continue", exact: true }).click();
	await page.getByLabel(/^password/i).fill(password);
	await page.getByRole("button", { name: "Continue", exact: true }).click();
	// The tab bar shows while signed out too; a page renders only once Clerk and
	// Convex both have the session.
	await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
	await page.context().storageState({ path: "e2e/.auth/user.json" });
});
