import { expect, type Page, test } from "@playwright/test";

// APP-191: the app column follows the system theme. Each page is captured in
// both colour schemes; in dark mode the shell must be dark and the active tab
// must stand apart from the inactive ones.

/** The app shell: the element the root layout gives the canvas colour. */
const shell = (page: Page) => page.locator("main").locator("xpath=..");

function luminance(rgb: string): number {
	const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? []).map(Number);
	const lin = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Opens the scorecard, starting a simulated round (never counted) if none is active. */
async function openRound(page: Page) {
	await page.goto("/card");
	const empty = page.getByText("No active round.");
	const title = page.getByRole("heading", { level: 1 });
	await expect(title).toBeVisible();
	if (await empty.isVisible()) {
		await page.goto("/rounds/new?simulate=1");
		await page
			.getByRole("heading", { name: "Course" })
			.locator("xpath=..")
			.getByRole("button")
			.first()
			.click();
		// A course with loops needs one picked before the round can start.
		const loop = page.getByRole("button", { name: /^\d+–\d+$/ }).first();
		const start = page.getByRole("button", { name: "Start simulation" });
		await expect(start.or(loop).first()).toBeVisible();
		if (await loop.isVisible()) await loop.click();
		await start.click();
		await page.waitForURL("**/play");
		await page.goto("/card");
	}
	await expect(empty).toHaveCount(0);
	await expect(title).not.toHaveText("Scorecard");
}

async function openCourseEditor(page: Page) {
	await page.goto("/courses");
	await page.getByRole("heading", { name: "Courses" }).waitFor();
	await page.locator('a[href^="/courses/"]').first().click();
	await page.getByRole("heading", { name: "Holes" }).waitFor();
}

/** Opens an owned copy of a catalog course, so its fields are editable.
 *  Returns the step that deletes the copy again. */
async function openOwnedCopy(page: Page) {
	await openCourseEditor(page);
	await page.getByRole("button", { name: "Make my copy" }).click();
	const remove = page.getByRole("button", { name: "Delete my copy" });
	await remove.waitFor();
	await expect(page.locator("main input").first()).toBeVisible();
	return async () => {
		page.once("dialog", (dialog) => dialog.accept());
		await remove.click();
		await page.waitForURL("**/courses");
	};
}

type Open = (page: Page) => Promise<void | (() => Promise<void>)>;

const PAGES: Record<string, Open> = {
	home: async (page) => {
		await page.goto("/");
		await page.locator("main").waitFor();
	},
	round: openRound,
	editor: openCourseEditor,
	copy: openOwnedCopy,
};

for (const scheme of ["light", "dark"] as const) {
	test.describe(`${scheme} theme`, () => {
		test.use({ colorScheme: scheme });

		for (const [name, open] of Object.entries(PAGES)) {
			test(name, async ({ page }, info) => {
				const cleanUp = await open(page);
				await page.waitForLoadState("networkidle");

				const canvas = await shell(page).evaluate(
					(el) => getComputedStyle(el).backgroundColor,
				);
				if (scheme === "dark") {
					expect(luminance(canvas)).toBeLessThan(0.05);
				} else {
					expect(luminance(canvas)).toBeGreaterThan(0.7);
				}

				// The course editor has no tab of its own, so no tab is active there.
				const tabs = await page.locator("nav a").evaluateAll((links) =>
					links.map((a) => ({
						active: a.getAttribute("aria-current") === "page",
						color: getComputedStyle(a).color,
					})),
				);
				const active = tabs.find((t) => t.active)?.color;
				const inactive = tabs.find((t) => !t.active)?.color ?? "";
				if (active) {
					expect(active).not.toBe(inactive);
					const [hi, lo] = [luminance(active), luminance(inactive)].sort(
						(a, b) => b - a,
					);
					expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(1.5);
				}

				await page.screenshot({
					path: info.outputPath(`${name}-${info.project.name}-${scheme}.png`),
					fullPage: true,
				});
				await cleanUp?.();
			});
		}

		test.describe("signed out", () => {
			test.use({ storageState: { cookies: [], origins: [] } });

			test("sign-in", async ({ page }, info) => {
				await page.goto("/");
				const email = page.getByLabel(/email address/i);
				await email.waitFor();
				const field = await email.evaluate(
					(el) => getComputedStyle(el).backgroundColor,
				);
				if (scheme === "dark") {
					expect(luminance(field)).toBeLessThan(0.05);
				} else {
					expect(luminance(field)).toBeGreaterThan(0.7);
				}
				await page.screenshot({
					path: info.outputPath(`sign-in-${info.project.name}-${scheme}.png`),
					fullPage: true,
				});
			});
		});
	});
}
