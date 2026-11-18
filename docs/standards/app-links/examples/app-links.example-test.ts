/**
 * Keeps the site files and the app's link config in step. Named so no test
 * runner picks up the toolkit copy in `docs/`. Copy to
 * `scripts/app-links.test.ts` (run from the repository root) and replace the
 * config below with an import of the app's `createAppLinks` input.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { type AppLink, buildAasa, createAppLinks, iosAssociatedDomains } from "./app-links.ts";

// Replace with the app's values (import them from the app module).
const TEAM_ID = "ABCDE12345";
const BUNDLE_ID = "com.example.app";
const HOST = "app.example.com";
const LINKS: AppLink[] = [
	{ path: "/join/*", param: /^[A-Za-z0-9]+$/, route: (t: string) => `/join/${t}`, comment: "Join links" },
	{
		path: "/invite",
		query: { token: /^[A-Za-z0-9]+$/, code: /^[A-Z0-9]{4}$/ },
		route: (q: Record<string, string>) => `/invite?${new URLSearchParams(q)}`,
		comment: "Invite links",
	},
];
const APP_IDS = [`${TEAM_ID}.${BUNDLE_ID}.preview`, `${TEAM_ID}.${BUNDLE_ID}`];
const AASA = "public/.well-known/apple-app-site-association";

const links = createAppLinks({ host: HOST, schemes: ["app", "app-preview", "app-dev"], links: LINKS });

describe.skipIf(!fs.existsSync(AASA))("site files", () => {
	it("serves the config's apple-app-site-association", () => {
		expect(JSON.parse(fs.readFileSync(AASA, "utf8"))).toEqual(buildAasa(APP_IDS, LINKS));
	});

	it("serves it as application/json", () => {
		expect(fs.readFileSync("public/_headers", "utf8")).toMatch(
			/^\/\.well-known\/apple-app-site-association\n\s+Content-Type: application\/json$/m,
		);
	});
});

describe("link routing", () => {
	it.each([
		`https://${HOST}/join/ABC`,
		`https://${HOST}/join/ABC/`,
		`https://${HOST}/join/ABC?utm=x`,
		"app://join/ABC",
		"app-preview:///join/ABC",
		"/join/ABC",
		"https://APP.Example.com/join/ABC",
		"APP://join/ABC",
	])("opens %s", (url) => {
		expect(links.routeFromUrl(url)).toBe("/join/ABC");
		expect(links.systemPath(url)).toBe("/join/ABC");
	});

	it.each([
		`https://${HOST}:444/join/ABC`,
		`https://evil.example/join/ABC`,
		`https://${HOST}/Join/ABC`,
		`https://${HOST}/join/AB-C`,
		"app://join//ABC",
		"app://join",
	])("sends %s home", (url) => {
		expect(links.routeFromUrl(url)).toBeNull();
		expect(links.systemPath(url)).toBe("/");
	});

	it.each([
		[`https://${HOST}/invite?token=ABC&utm=x`, "/invite?token=ABC"],
		[`https://${HOST}/invite?code=AB12&token=b-a-d`, "/invite?code=AB12"],
		["app://invite?token=ABC&token=XYZ", "/invite?token=ABC"],
		[`https://${HOST}/invite`, "/invite?"],
		["/invite?token=%E0%A4%A", "/invite?"],
	])("keeps only valid query keys of %s", (url, route) => {
		expect(links.systemPath(url)).toBe(route);
	});

	it("rebuilds a query route from the router's search params", () => {
		expect(links.routeFromPathname("/invite", { token: ["ABC", "XYZ"], other: "1" })).toBe(
			"/invite?token=ABC",
		);
	});

	it("adds associated domains only to variants that claim links", () => {
		expect(iosAssociatedDomains(HOST, true)).toEqual({
			associatedDomains: [`applinks:${HOST}`, `webcredentials:${HOST}`],
		});
		expect(iosAssociatedDomains(HOST, false)).not.toHaveProperty("associatedDomains");
	});

	it("passes other app-scheme links through", () => {
		expect(links.systemPath("app://sso-callback?code=1")).toBe("app://sso-callback?code=1");
	});

	it("remembers only whole claimed pathnames", () => {
		expect(links.routeFromPathname("/join/ABC")).toBe("/join/ABC");
		expect(links.routeFromPathname("/join/ABC/")).toBeNull();
		expect(links.routeFromPathname("/join/AB#C")).toBeNull();
		expect(links.routeFromPathname("/settings")).toBeNull();
	});
});
