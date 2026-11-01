import type { ErrorEvent } from "@sentry/react-native";
import {
	buildSentryOptions,
	environmentFromChannel,
	routeName,
	sanitizeBreadcrumb,
	sanitizeEvent,
	shouldInitSentry,
} from "./options";

describe("shouldInitSentry", () => {
	it("needs a DSN and stays silent in development bundles", () => {
		expect(
			shouldInitSentry({ dsn: undefined, dev: false, debug: undefined }),
		).toBe(false);
		expect(shouldInitSentry({ dsn: "x", dev: true, debug: undefined })).toBe(
			false,
		);
		expect(shouldInitSentry({ dsn: "x", dev: true, debug: "1" })).toBe(true);
		expect(shouldInitSentry({ dsn: "x", dev: false, debug: undefined })).toBe(
			true,
		);
	});
});

describe("environmentFromChannel", () => {
	it("maps EAS channels to environments", () => {
		expect(environmentFromChannel("preview", false)).toBe("preview");
		expect(environmentFromChannel("production", false)).toBe("production");
		expect(environmentFromChannel(null, true)).toBe("development");
	});
});

describe("privacy", () => {
	it("sends no PII, tracing or replay", () => {
		const options = buildSentryOptions({ dsn: "x", environment: "production" });
		expect(options.sendDefaultPii).toBe(false);
		expect(options.enableAutoPerformanceTracing).toBe(false);
		expect(options.attachScreenshot).toBe(false);
	});

	it("drops the user and query strings from events", () => {
		const event = sanitizeEvent({
			type: undefined,
			user: { id: "u1", email: "a@b.c" },
			request: { url: "fairway://round?id=secret", cookies: { a: "b" } },
		} as ErrorEvent);
		expect(event.user).toBeUndefined();
		expect(event.request).toEqual({ url: "fairway://round" });
	});

	it("strips console arguments and URL queries from breadcrumbs", () => {
		expect(
			sanitizeBreadcrumb({
				category: "console",
				message: "m",
				data: { arguments: ["Ann"] },
			}),
		).toEqual({ category: "console", message: "m" });
		expect(
			sanitizeBreadcrumb({
				category: "fetch",
				data: { url: "https://x.dev/a?code=ABC" },
			})?.data,
		).toEqual({ url: "https://x.dev/a" });
	});

	it("names routes by pattern", () => {
		expect(routeName(["(app)", "play", "[roundId]"])).toBe(
			"/(app)/play/[roundId]",
		);
	});
});
