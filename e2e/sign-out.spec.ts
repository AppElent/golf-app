import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in";

// APP-116: a signed-in web user signs out from the Account page; afterwards
// every protected path shows Clerk's sign-in card and no app content. Since
// APP-235 sign-out lands on the public "Open the Fairway app" page. Runs in
// its own project with a fresh session, so revoking it leaves the stored
// session of the desktop and phone projects alone.

test("sign in, sign out, and protected paths ask to sign in", async ({
	page,
}, info) => {
	await signIn(page);
	await page.goto("/profile");
	await page.getByRole("heading", { name: "Account", level: 1 }).waitFor();
	await expect(page.getByText(/signed in as/i)).toBeVisible();
	await page.screenshot({
		path: info.outputPath("profile-account.png"),
		fullPage: true,
	});

	await page.getByRole("button", { name: "Sign out" }).click();
	// Clerk's afterSignOutUrl, plus any hash the sign-in card adds.
	const home = new URL("/", page.url()).href;
	await expect(page).toHaveURL((url) => url.href.split("#")[0] === home, {
		timeout: 30_000,
	});
	await expect(
		page.getByRole("heading", { name: "Open the Fairway app" }),
	).toBeVisible({ timeout: 30_000 });

	for (const path of ["/profile", "/courses"]) {
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
