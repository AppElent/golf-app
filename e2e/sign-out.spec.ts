import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";

// APP-116: a signed-in web user signs out from the profile page; afterwards
// every protected path shows Clerk's sign-in card and no app content. Runs in
// its own project with a fresh session, so revoking it leaves the stored
// session of the desktop and phone projects alone.

test("sign in, sign out, and protected paths ask to sign in", async ({
	page,
}, info) => {
	await signIn(page);
	await page.goto("/profile");
	await page.getByRole("heading", { name: "Account" }).waitFor();
	await expect(page.getByText(/signed in as/i)).toBeVisible();
	await page.screenshot({
		path: info.outputPath("profile-account.png"),
		fullPage: true,
	});

	await page.getByRole("button", { name: "Sign out" }).click();
	// Clerk's afterSignOutUrl.
	await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
	await expect(page.getByLabel(/email address/i)).toBeVisible({
		timeout: 30_000,
	});
	await expect(page.locator("main")).toHaveCount(0);

	for (const path of ["/profile", "/courses", "/progress"]) {
		await page.goto(path);
		await expect(page.getByLabel(/email address/i)).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.locator("main")).toHaveCount(0);
	}
	await page.screenshot({
		path: info.outputPath("signed-out.png"),
		fullPage: true,
	});
});
