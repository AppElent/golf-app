import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
	DataDeletedNotice,
	forgetDataDeleted,
	rememberDataDeleted,
} from "./data-deleted-notice";

afterEach(() => {
	cleanup();
	window.sessionStorage.clear();
});

it("confirms the deletion once, on the next sign-in card", () => {
	rememberDataDeleted();
	render(<DataDeletedNotice />);
	expect(screen.getByRole("status").textContent).toMatch(
		/still works in gather, foundry and arcade club/i,
	);
	cleanup();
	render(<DataDeletedNotice />);
	expect(screen.queryByRole("status")).toBeNull();
});

it("shows nothing when nothing was deleted", () => {
	rememberDataDeleted();
	forgetDataDeleted();
	render(<DataDeletedNotice />);
	expect(screen.queryByRole("status")).toBeNull();
});
