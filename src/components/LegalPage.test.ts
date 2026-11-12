import { describe, expect, it } from "vitest";
import { isPublicPath } from "./LegalPage";

describe("isPublicPath", () => {
	it("opens the privacy and support pages without sign-in", () => {
		expect(isPublicPath("/privacy")).toBe(true);
		expect(isPublicPath("/support/")).toBe(true);
	});

	it("keeps every other page behind sign-in", () => {
		expect(isPublicPath("/")).toBe(false);
		expect(isPublicPath("/profile")).toBe(false);
		expect(isPublicPath("/privacy-settings")).toBe(false);
		expect(isPublicPath("/privacy/rounds")).toBe(false);
		expect(isPublicPath("/PRIVACY")).toBe(false);
		expect(isPublicPath("/%70rivacy")).toBe(false);
	});

	it("treats repeated trailing slashes like one", () => {
		expect(isPublicPath("/privacy//")).toBe(true);
	});
});
