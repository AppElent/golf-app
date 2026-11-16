import { expect, type Page, test } from "@playwright/test";

// APP-117: course authoring is `large-screen` in features.ts. On a desktop it
// uses the window's width; at phone width it shows the "best on a larger
// screen" notice. Every other page keeps the 430px phone column.

const PHONE_COLUMN = 430;

/** The app shell: the element the root layout caps at 430px. */
const shell = (page: Page) => page.locator("main").locator("xpath=..");

async function width(page: Page, locator = shell(page)) {
	const box = await locator.boundingBox();
	if (!box) throw new Error("shell not rendered");
	return box.width;
}

async function expectNoSideScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth,
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

const notice = (page: Page) => page.getByRole("note");

async function openFirstCourse(page: Page) {
	await page.goto("/courses");
	await page.getByRole("heading", { name: "Courses" }).waitFor();
	await page.locator('a[href^="/courses/"]').first().click();
	await page.getByRole("heading", { name: "Holes" }).waitFor();
}

test("course list", async ({ page }, info) => {
	await page.goto("/courses");
	await page.getByRole("heading", { name: "Courses" }).waitFor();
	await page.locator('a[href^="/courses/"]').first().waitFor();
	const viewport = page.viewportSize()?.width ?? 0;

	expect(await width(page)).toBe(viewport);
	if (info.project.name === "desktop") {
		await expect(notice(page)).toBeHidden();
		expect(await width(page, page.locator("main"))).toBeGreaterThan(1000);
	} else {
		await expect(notice(page)).toBeVisible();
		await expect(notice(page)).toContainText("Best on a larger screen");
	}
	await expectNoSideScroll(page);
	await page.screenshot({
		path: info.outputPath(`courses-${info.project.name}.png`),
		fullPage: true,
	});
});

test("course editor", async ({ page }, info) => {
	await openFirstCourse(page);
	const viewport = page.viewportSize()?.width ?? 0;
	expect(await width(page)).toBe(viewport);

	const tees = page.getByRole("heading", { name: /^Tees?$/ }).first();
	const holes = page.getByRole("heading", { name: "Holes" });
	const teeBox = await tees.boundingBox();
	const holeBox = await holes.boundingBox();
	if (!teeBox || !holeBox) throw new Error("editor sections not rendered");

	if (info.project.name === "desktop") {
		await expect(notice(page)).toBeHidden();
		// Two columns: holes sit beside the tee details, not below them.
		expect(holeBox.x).toBeGreaterThan(teeBox.x + teeBox.width);
	} else {
		await expect(notice(page)).toBeVisible();
		expect(holeBox.y).toBeGreaterThan(teeBox.y);
	}
	await expectNoSideScroll(page);
	await page.screenshot({
		path: info.outputPath(`editor-${info.project.name}.png`),
		fullPage: true,
	});
});

for (const path of ["/", "/profile"]) {
	test(`${path} keeps the phone column`, async ({ page }) => {
		await page.goto(path);
		await page.locator("main").waitFor();
		const viewport = page.viewportSize()?.width ?? 0;
		expect(await width(page)).toBe(Math.min(viewport, PHONE_COLUMN));
		await expect(notice(page)).toHaveCount(0);
	});
}
