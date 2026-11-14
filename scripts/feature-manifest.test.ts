import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FEATURES } from "@fairway/core/features";
import { describe, expect, it } from "vitest";
import { checkFeatureManifest, listRouteFiles } from "./feature-manifest-check";

const repo = path.resolve(import.meta.dirname, "..");

const routes = {
	web: listRouteFiles(path.join(repo, "src/routes")),
	mobile: listRouteFiles(path.join(repo, "apps/mobile/app")),
};

it("maps every web and mobile route to a feature", () => {
	expect(checkFeatureManifest(FEATURES, routes)).toEqual([]);
});

it("sees the real route trees", () => {
	expect(routes.web).toContain("courses.$courseId.edit");
	expect(routes.mobile).toContain("(app)/play");
	expect(routes.web).not.toContain("__root");
	expect(routes.mobile.some((route) => route.endsWith("_layout"))).toBe(false);
});

describe("drift", () => {
	it("fails on a route that belongs to no feature", () => {
		const drifted = {
			web: [...routes.web, "drift-probe"],
			mobile: [...routes.mobile, "(app)/(tabs)/drift-probe"],
		};
		expect(checkFeatureManifest(FEATURES, drifted)).toEqual([
			'web route "drift-probe" belongs to no feature; add it to features.ts',
			'mobile route "(app)/(tabs)/drift-probe" belongs to no feature; add it to features.ts',
		]);
	});

	it("fails on a pattern that matches no route", () => {
		const withoutPrivacy = {
			...routes,
			web: routes.web.filter((route) => route !== "privacy"),
		};
		expect(checkFeatureManifest(FEATURES, withoutPrivacy)).toEqual([
			'privacy: web pattern "privacy" matches no route',
		]);
	});

	it("lists a new route file and skips layouts", () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "feature-routes-"));
		try {
			for (const file of [
				"_layout.tsx",
				"(app)/_layout.tsx",
				"(app)/new.tsx",
			]) {
				fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
				fs.writeFileSync(path.join(root, file), "");
			}
			expect(listRouteFiles(root)).toEqual(["(app)/new"]);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});
