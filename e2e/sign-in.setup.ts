import { test as setup } from "@playwright/test";
import { signIn } from "./sign-in";

// Signs in once and saves the session for the desktop and phone projects. Use
// the development instance's test user.
setup("sign in", async ({ page }) => {
	await signIn(page);
	await page.context().storageState({ path: "e2e/.auth/user.json" });
});
