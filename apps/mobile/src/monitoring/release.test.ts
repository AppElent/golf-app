import { buildLabel, sentryRelease } from "./release";

describe("sentryRelease", () => {
	it("names an update by version and short commit", () => {
		expect(sentryRelease("1.4.0", "a1b2c3d4e5f6")).toBe(
			"fairway@1.4.0+a1b2c3d",
		);
	});

	it("leaves the SDK default when the commit is unknown", () => {
		expect(sentryRelease("1.4.0", undefined)).toBeUndefined();
		expect(sentryRelease("1.4.0", " ")).toBeUndefined();
	});
});

describe("buildLabel", () => {
	it("shows version, build, channel and the update a phone runs", () => {
		expect(
			buildLabel({
				version: "1.4.0",
				build: "37",
				channel: "production",
				updateId: "01a1e52b-0000-4000-8000-000000000000",
				embedded: false,
			}),
		).toBe("1.4.0 (37) · production · 01a1e52b");
	});

	it("omits the update id when the bundled code runs", () => {
		expect(
			buildLabel({
				version: "1.4.0",
				build: "37",
				channel: "preview",
				updateId: "01a1e52b-0000-4000-8000-000000000000",
				embedded: true,
			}),
		).toBe("1.4.0 (37) · preview");
	});

	it("copes with a development build", () => {
		expect(
			buildLabel({
				version: "1.4.0",
				build: null,
				channel: null,
				updateId: null,
				embedded: true,
			}),
		).toBe("1.4.0");
	});
});
