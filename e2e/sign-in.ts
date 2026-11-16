import { expect, type Page } from "@playwright/test";

/** Signs in through Clerk's <SignIn> card as the development test user. */
export async function signIn(page: Page) {
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
}
