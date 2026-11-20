import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: object) => ({ options }),
	Link: ({ to, ...props }: { to: string } & object) => (
		<a href={to} {...props} />
	),
}));

import { Route } from "../routes/index";
import { APP_STORE_URL, TESTFLIGHT_URL } from "./app-links";

afterEach(cleanup);

const OpenTheApp = (
	Route as unknown as { options: { component: ComponentType } }
).options.component;

it("points to the app, its preview, and what the web still does", () => {
	render(<OpenTheApp />);
	expect(
		screen.getByRole("heading", { level: 1, name: "Open the Fairway app" }),
	).toBeTruthy();
	const href = (name: RegExp) =>
		screen.getByRole("link", { name }).getAttribute("href");
	expect(href(/app store/i)).toBe(APP_STORE_URL);
	expect(href(/testflight/i)).toBe(TESTFLIGHT_URL);
	expect(href(/edit courses/i)).toBe("/courses");
	expect(href(/account/i)).toBe("/profile");
});
