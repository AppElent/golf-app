import { expect, type Page } from "@playwright/test";

/** The passwordless test user on the Clerk development instance. */
export const DEFAULT_E2E_USER_EMAIL = "fairway-e2e+clerk_test@example.com";

/** Clerk development instances accept this code for `+clerk_test` emails. */
const CLERK_TEST_VERIFICATION_CODE = "424242";

/**
 * Signs in through Clerk's <SignIn> card. Without `E2E_USER_PASSWORD` it signs
 * in a `+clerk_test` user with Clerk's fixed test code, which only the
 * development instance accepts, so no credentials are needed.
 */
export async function signIn(page: Page) {
	const email = process.env.E2E_USER_EMAIL || DEFAULT_E2E_USER_EMAIL;
	const password = process.env.E2E_USER_PASSWORD;
	if (!password && !/\+clerk_test@/i.test(email)) {
		throw new Error(
			"Without E2E_USER_PASSWORD, E2E_USER_EMAIL must be a +clerk_test address.",
		);
	}
	// "/" is public since APP-235; a protected path shows the sign-in card.
	await page.goto("/profile");
	await page.getByLabel(/email address/i).fill(email);
	await page.getByRole("button", { name: "Continue", exact: true }).click();
	if (password) {
		await page.getByLabel(/^password/i).fill(password);
		await page.getByRole("button", { name: "Continue", exact: true }).click();
	} else {
		// The instance offers an email link first; the test code needs email code.
		await page.getByRole("link", { name: "Use another method" }).click();
		// Typing before Clerk has prepared the code fails with "You need to send a
		// verification code before attempting to verify".
		const codeSent = page.waitForResponse(
			(res) =>
				res.url().includes("/prepare_first_factor") &&
				(res.request().postData() ?? "").includes("strategy=email_code") &&
				res.ok(),
		);
		await page.getByRole("button", { name: /email code/i }).click();
		await codeSent;
		// Clerk submits once all six digits are in.
		await page
			.getByRole("textbox", { name: "Enter verification code" })
			.pressSequentially(CLERK_TEST_VERIFICATION_CODE);
	}
	// The tab bar shows while signed out too; a page renders only once Clerk and
	// Convex both have the session.
	await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
}
