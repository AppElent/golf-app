import { describe, expect, it } from "vitest";
import {
	isLocalReportingUrl,
	sentryEnvironment,
	tracesSampleRate,
} from "./config";

describe("isLocalReportingUrl", () => {
	it.each([
		"http://localhost:3000/",
		"http://app.localhost/",
		"http://127.0.0.1:8787/",
		"http://127.0.0.2/",
		"http://[::1]:3000/",
		"http://0.0.0.0:3000/",
		"HTTP://LOCALHOST:3000/play",
	])("disables reporting for local URL %s", (url) => {
		expect(isLocalReportingUrl(url)).toBe(true);
	});

	it.each([
		"https://golf-app.appelent.workers.dev/",
		"https://golf-app-pr-42.appelent.workers.dev/",
		"https://localhost.example.com/",
		"https://example.com/?redirect=http://localhost:3000/",
		"https://example.com/localhost",
	])("keeps reporting enabled for deployed URL %s", (url) => {
		expect(isLocalReportingUrl(url)).toBe(false);
	});
});

describe("sentryEnvironment", () => {
	it("uses the deployment name the build was given", () => {
		expect(sentryEnvironment("preview")).toBe("preview");
	});

	it("labels an unnamed build instead of guessing from the build mode", () => {
		expect(sentryEnvironment(undefined)).toBe("unknown");
		expect(sentryEnvironment("  ")).toBe("unknown");
	});
});

it("samples production transactions and keeps every preview transaction", () => {
	expect(tracesSampleRate("production")).toBeLessThan(1);
	expect(tracesSampleRate("preview")).toBe(1);
});
