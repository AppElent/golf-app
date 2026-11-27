import { expect, test } from "@playwright/test";

// TEMPORARY (APP-977): fails on purpose to prove the CI artifact upload.
test("deliberate failure", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByText("this text is not on the page")).toBeVisible({
		timeout: 2_000,
	});
});
