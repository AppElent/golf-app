import type { ErrorEvent, Event } from "@sentry/react-native";
import { en } from "../i18n/messages/en";
import { nl } from "../i18n/messages/nl";
import { darkColors, lightColors } from "../theme/tokens";
import {
	buildSentryOptions,
	environmentFromChannel,
	FEEDBACK_OPTIONS,
	feedbackLabels,
	feedbackTheme,
	sanitizeBreadcrumb,
	sanitizeEvent,
	sanitizeFeedbackEvent,
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
		expect(environmentFromChannel("development", false)).toBe("development");
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

	it("scrubs everything the SDK is about to send", () => {
		const options = buildSentryOptions({ dsn: "x", environment: "production" });
		const event = options.beforeSend({
			type: undefined,
			user: { id: "u1" },
		} as ErrorEvent);
		expect(event.user).toBeUndefined();
		expect(
			options.beforeBreadcrumb({
				category: "console",
				data: { arguments: ["Ann"] },
			}),
		).toEqual({ category: "console" });
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
});

describe("feedback", () => {
	it("strips the user, contact fields and query string from a report", () => {
		const event = sanitizeFeedbackEvent({
			type: "feedback",
			user: { id: "u1", email: "a@b.c" },
			request: { url: "fairway://play?round=1" },
			contexts: {
				feedback: {
					message: "Distance is wrong",
					contact_email: "a@b.c",
					name: "Ann",
					url: "fairway://play?round=1",
				},
			},
		} as Event);
		expect(event.user).toBeUndefined();
		expect(event.request).toBeUndefined();
		expect(event.contexts?.feedback).toEqual({
			message: "Distance is wrong",
			url: "fairway://play",
		});
	});

	it("leaves other events to the error hooks", () => {
		const event = { type: undefined, user: { id: "u1" } } as ErrorEvent;
		expect(sanitizeFeedbackEvent(event)).toBe(event);
	});

	it("asks for no name or email and starts no shake on its own", () => {
		expect(FEEDBACK_OPTIONS).toMatchObject({
			showName: false,
			showEmail: false,
			enableShakeToReport: false,
		});
	});

	it("labels the form in both languages and themes it from the tokens", () => {
		expect(feedbackLabels(en.feedback).formTitle).toBe("Report a problem");
		expect(feedbackLabels(nl.feedback).formTitle).toBe("Probleem melden");
		expect(feedbackTheme(lightColors).accentBackground).toBe(
			lightColors.accentFill,
		);
		expect(feedbackTheme(darkColors).background).toBe(darkColors.bg);
	});
});
