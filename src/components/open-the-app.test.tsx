import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, ...props }: { to: string } & object) => (
		<a href={to} {...props} />
	),
}));

import { APP_STORE_URL, TESTFLIGHT_URL } from "./app-links";
import { OpenTheApp } from "./open-the-app";

afterEach(cleanup);

const href = (name: RegExp) =>
	screen.getByRole("link", { name }).getAttribute("href");

function expectWebLinks() {
	expect(
		screen.getByRole("heading", { level: 1, name: "Open the Fairway app" }),
	).toBeTruthy();
	expect(href(/edit courses/i)).toBe("/courses");
	expect(href(/account/i)).toBe("/profile");
}

describe("before the App Store release", () => {
	it("leads with the TestFlight beta and shows no App Store button", () => {
		render(<OpenTheApp storeLive={false} />);
		expect(href(/join the fairway beta on testflight/i)).toBe(TESTFLIGHT_URL);
		expect(screen.queryByRole("link", { name: /app store/i })).toBeNull();
		expect(document.querySelector(`a[href="${APP_STORE_URL}"]`)).toBeNull();
		expectWebLinks();
	});
});

describe("once Fairway is on the App Store", () => {
	it("leads with the App Store and keeps TestFlight for the preview", () => {
		render(<OpenTheApp storeLive />);
		expect(href(/get fairway on the app store/i)).toBe(APP_STORE_URL);
		expect(href(/join the testflight beta/i)).toBe(TESTFLIGHT_URL);
		expectWebLinks();
	});
});
