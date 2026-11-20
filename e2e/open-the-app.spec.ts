import { expect, test } from "@playwright/test";

// APP-235: the web's round screens are retired. Their paths land on the
// public "Open the Fairway app" page, signed in or not.

for (const path of ["/play", "/card", "/rounds/new", "/progress"]) {
	test(`${path} opens the app page`, async ({ page }) => {
		await page.goto(path);
		await expect(page).toHaveURL((url) => url.pathname === "/");
		await expect(
			page.getByRole("heading", { name: "Open the Fairway app" }),
		).toBeVisible();
		await expect(page.getByRole("link", { name: /app store/i })).toBeVisible();
		await expect(
			page.getByRole("link", { name: /edit courses/i }),
		).toBeVisible();
	});
}
