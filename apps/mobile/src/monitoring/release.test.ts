import { buildLabel, otaLabel, sentryRelease } from "./release";

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

describe("otaLabel", () => {
	const createdAt = new Date("2026-11-20T09:12:00Z");

	it("labels an update by version, publish day and short commit", () => {
		expect(
			otaLabel({
				version: "1.0.0",
				createdAt,
				commit: "a1b2c3d4e5f6",
				embedded: false,
			}),
		).toBe("1.0.0 · 20 nov · a1b2c3d");
	});

	it("shows the Amsterdam day, not the UTC one", () => {
		expect(
			otaLabel({
				version: "1.0.0",
				createdAt: new Date("2026-11-20T23:30:00Z"),
				commit: "a1b2c3d",
				embedded: false,
			}),
		).toBe("1.0.0 · 21 nov · a1b2c3d");
	});

	it("has no label on the bundled code or without a commit", () => {
		const base = { version: "1.0.0", createdAt, commit: "a1b2c3d" };
		expect(otaLabel({ ...base, embedded: true })).toBeNull();
		expect(
			otaLabel({ ...base, commit: undefined, embedded: false }),
		).toBeNull();
		expect(
			otaLabel({ ...base, commit: "not-a-sha", embedded: false }),
		).toBeNull();
		expect(otaLabel({ ...base, createdAt: null, embedded: false })).toBeNull();
	});
});

describe("buildLabel", () => {
	const base = {
		version: "1.0.0",
		build: "37",
		channel: "preview",
		updateId: "01a1e52b-0000-4000-8000-000000000000",
		noUpdate: "geen update",
	};

	it("shows version, build, the update label and the channel", () => {
		expect(
			buildLabel({
				...base,
				embedded: false,
				label: "1.0.0 · 20 nov · a1b2c3d",
			}),
		).toBe("1.0.0 (37) · update 1.0.0 · 20 nov · a1b2c3d · preview");
	});

	it("says there is no update on the bundled code", () => {
		expect(buildLabel({ ...base, embedded: true, label: null })).toBe(
			"1.0.0 (37) · geen update · preview",
		);
	});

	it("falls back to the update id when an update has no label", () => {
		expect(buildLabel({ ...base, embedded: false, label: null })).toBe(
			"1.0.0 (37) · update 01a1e52b · preview",
		);
	});

	it("copes with a development build", () => {
		expect(
			buildLabel({
				version: "1.0.0",
				build: null,
				channel: null,
				updateId: null,
				embedded: true,
				label: null,
				noUpdate: "geen update",
			}),
		).toBe("1.0.0 · geen update");
	});
});
