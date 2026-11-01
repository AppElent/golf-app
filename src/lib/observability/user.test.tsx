import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	auth: { isLoaded: true, userId: "user_123" as string | null },
	setUser: vi.fn(),
}));
vi.mock("@clerk/react", () => ({ useAuth: () => mocks.auth }));
vi.mock("@sentry/react", () => ({ setUser: mocks.setUser }));

import { SentryUser } from "./user";

beforeEach(() => {
	vi.clearAllMocks();
	mocks.auth = { isLoaded: true, userId: "user_123" };
});

it("sets the opaque user id only, and clears it on sign-out", () => {
	const { rerender } = render(<SentryUser />);
	expect(mocks.setUser).toHaveBeenLastCalledWith({ id: "user_123" });

	mocks.auth = { isLoaded: true, userId: null };
	rerender(<SentryUser />);
	expect(mocks.setUser).toHaveBeenLastCalledWith(null);
});

it("clears the user on unmount", () => {
	const { unmount } = render(<SentryUser />);
	unmount();
	expect(mocks.setUser).toHaveBeenLastCalledWith(null);
});
