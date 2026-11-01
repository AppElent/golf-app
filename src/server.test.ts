import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	startFetch: vi.fn(),
	sentryFetch: vi.fn(),
}));

vi.mock("@tanstack/react-start/server-entry", () => ({
	default: { fetch: mocks.startFetch },
}));
vi.mock("@sentry/cloudflare", () => ({
	withSentry: () => ({ fetch: mocks.sentryFetch }),
}));

import server from "./server";

const ctx = {} as ExecutionContext;

beforeEach(() => vi.clearAllMocks());

it("bypasses Sentry for a local SSR 500 despite production bindings", async () => {
	const response = new Response("SSR failure", { status: 500 });
	mocks.startFetch.mockResolvedValue(response);
	const request = new Request("http://localhost:8787/play");

	expect(
		await server.fetch(request, { environment_name: "production" }, ctx),
	).toBe(response);
	expect(mocks.startFetch).toHaveBeenCalledWith(request);
	expect(mocks.sentryFetch).not.toHaveBeenCalled();
});

it("sends a deployed request through the Sentry wrapper", async () => {
	const response = new Response("SSR failure", { status: 500 });
	mocks.sentryFetch.mockResolvedValue(response);
	const request = new Request("https://golf-app-pr-42.appelent.workers.dev/");
	const env = { environment_name: "preview" };

	expect(await server.fetch(request, env, ctx)).toBe(response);
	expect(mocks.sentryFetch).toHaveBeenCalledWith(request, env, ctx);
	expect(mocks.startFetch).not.toHaveBeenCalled();
});
