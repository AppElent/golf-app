import type { Event } from "@sentry/react";
import { describe, expect, it } from "vitest";
import { sanitizeBreadcrumb, sanitizeEvent, sanitizeText } from "./privacy";

describe("sanitizeText", () => {
	it("redacts credentials and email addresses but keeps the error text", () => {
		expect(
			sanitizeText(
				"Request failed for golfer@example.com: Bearer abc123 https://api.test?token=secret",
			),
		).toBe(
			"Request failed for [Filtered]: Bearer [Filtered] https://api.test?token=[Filtered]",
		);
	});

	it("redacts JWTs", () => {
		expect(sanitizeText("token eyJhbGc.eyJzdWIi.c2lnbmF0dXJl")).toBe(
			"token [Filtered]",
		);
	});

	it("redacts the arguments a Convex validator error echoes back", () => {
		expect(
			sanitizeText(
				'ArgumentValidationError: Object is missing the required field `holeIndex`.\n\nObject: {players: ["Anna"]}\nValidator: v.object({holeIndex: v.float64()})',
			),
		).toBe(
			"ArgumentValidationError: Object is missing the required field `holeIndex`.\n\nObject: [Filtered]\nValidator: v.object({holeIndex: v.float64()})",
		);
	});
});

describe("sanitizeEvent", () => {
	it("keeps the opaque user id and the stack, drops everything personal", () => {
		const event: Event = {
			user: {
				id: "user_123",
				email: "golfer@example.com",
				username: "anna",
				ip_address: "127.0.0.1",
			},
			request: {
				url: "https://golf.test/play?round=abc#hole-3",
				method: "GET",
				headers: { Authorization: "secret", Cookie: "__session=x" },
				cookies: { __session: "x" },
				data: { strokes: 4 },
				query_string: "round=abc",
			},
			extra: { players: ["Anna"] },
			exception: {
				values: [
					{
						value: "Failed for golfer@example.com",
						stacktrace: {
							frames: [
								{ filename: "play.tsx", lineno: 12, vars: { name: "Anna" } },
							],
						},
					},
				],
			},
			breadcrumbs: [
				{ category: "console", message: "players: Anna, Bob" },
				{ category: "navigation", data: { from: "/play?x=1", to: "/card" } },
			],
		};
		const result = sanitizeEvent(event);
		expect(result.user).toEqual({ id: "user_123" });
		expect(result.request).toEqual({
			url: "https://golf.test/play",
			method: "GET",
		});
		expect(result.extra).toBeUndefined();
		expect(result.exception?.values?.[0].value).toBe("Failed for [Filtered]");
		expect(result.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({
			filename: "play.tsx",
			lineno: 12,
		});
		expect(result.breadcrumbs).toEqual([
			{
				category: "navigation",
				message: undefined,
				data: { from: "/play", to: "/card" },
			},
		]);
	});

	it("drops a user without an id instead of sending its other fields", () => {
		expect(
			sanitizeEvent({ user: { email: "golfer@example.com" } }).user,
		).toBeUndefined();
	});
});

describe("sanitizeBreadcrumb", () => {
	it("drops console output", () => {
		expect(
			sanitizeBreadcrumb({ category: "console", message: "private payload" }),
		).toBeNull();
	});

	it("keeps structural network fields only", () => {
		expect(
			sanitizeBreadcrumb({
				category: "fetch",
				data: {
					url: "https://api.test/x?token=secret",
					method: "POST",
					status_code: 500,
					body: "private",
					request_body_size: 10,
				},
			})?.data,
		).toEqual({ url: "https://api.test/x", method: "POST", status_code: 500 });
	});
});
