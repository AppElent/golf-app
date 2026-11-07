import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	startFetch: vi.fn(),
	captureMessage: vi.fn(),
}));

vi.mock("@tanstack/react-start/server-entry", () => ({
	default: { fetch: mocks.startFetch },
}));
// Sentry's wrapper hands the request to the handler; what is reported is ours.
vi.mock("@sentry/cloudflare", () => ({
	withSentry: (_options: unknown, handler: unknown) => handler,
	captureMessage: mocks.captureMessage,
}));

import server from "./server";

const ctx = {} as ExecutionContext;
const deployed = "https://golf-app-pr-42.appelent.workers.dev/";

beforeEach(() => vi.clearAllMocks());

it("reports nothing for a local SSR 500, even with production bindings", async () => {
	const response = new Response("SSR failure", { status: 500 });
	mocks.startFetch.mockResolvedValue(response);
	const request = new Request("http://localhost:8787/play");

	expect(
		await server.fetch(request, { environment_name: "production" }, ctx),
	).toBe(response);
	expect(mocks.startFetch).toHaveBeenCalledWith(request);
	expect(mocks.captureMessage).not.toHaveBeenCalled();
});

it("reports a deployed SSR 500 and still returns it", async () => {
	const response = new Response("SSR failure", { status: 500 });
	mocks.startFetch.mockResolvedValue(response);
	const env = { environment_name: "preview" };

	expect(await server.fetch(new Request(deployed), env, ctx)).toBe(response);
	expect(mocks.captureMessage).toHaveBeenCalledTimes(1);
});

it("reports nothing for a deployed page that renders", async () => {
	const response = new Response("ok");
	mocks.startFetch.mockResolvedValue(response);

	expect(await server.fetch(new Request(deployed), {}, ctx)).toBe(response);
	expect(mocks.captureMessage).not.toHaveBeenCalled();
});
