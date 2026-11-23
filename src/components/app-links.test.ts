import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { APP_STORE_ID, APP_STORE_URL, isRetiredPath } from "./app-links";

it("links the App Store listing of the app eas.json submits to", () => {
	const eas = JSON.parse(
		fs.readFileSync(
			path.resolve(import.meta.dirname, "../../apps/mobile/eas.json"),
			"utf8",
		),
	);
	expect(eas.submit.production.ios.ascAppId).toBe(APP_STORE_ID);
	expect(APP_STORE_URL).toBe(`https://apps.apple.com/app/id${APP_STORE_ID}`);
});

it("matches the retired round paths exactly", () => {
	expect(isRetiredPath("/play")).toBe(true);
	expect(isRetiredPath("/rounds/new/")).toBe(true);
	expect(isRetiredPath("/")).toBe(false);
	expect(isRetiredPath("/profile")).toBe(false);
	expect(isRetiredPath("/courses")).toBe(false);
	expect(isRetiredPath("/playground")).toBe(false);
	expect(isRetiredPath("/PLAY")).toBe(false);
});
