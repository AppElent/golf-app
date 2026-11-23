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

import { convexDeployment } from "./lib/release/version";
import server from "./server";

const ctx = {} as ExecutionContext;
const deployed = "https://golf-app-pr-42.appelent.workers.dev/";

beforeEach(() => vi.clearAllMocks());

it("reports nothing for a local SSR 500, even with production bindings", async () => {
	const response = new Response("SSR failure", { status: 500 });
	mocks.startFetch.mockResolvedValue(response);
	const request = new Request("http://localhost:8787/courses");

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

it("answers /version without rendering the app", async () => {
	const response = await server.fetch(
		new Request("https://fairway.appelent.nl/version"),
		{ environment_name: "staging" },
		ctx,
	);

	expect(mocks.startFetch).not.toHaveBeenCalled();
	expect(response.headers.get("cache-control")).toBe("no-store");
	expect(await response.json()).toMatchObject({
		app: "fairway",
		environment: "staging",
	});
	expect(convexDeployment("https://fine-heron-5.eu-west-1.convex.cloud")).toBe(
		"fine-heron-5",
	);
	expect(convexDeployment("not a url")).toBeNull();
});

it("leaves other methods on /version to the app", async () => {
	const response = new Response("ok");
	mocks.startFetch.mockResolvedValue(response);

	await server.fetch(
		new Request("https://fairway.appelent.nl/version", { method: "POST" }),
		{},
		ctx,
	);
	expect(mocks.startFetch).toHaveBeenCalledTimes(1);
});

it("sends the retired round paths to Open the Fairway app", async () => {
	for (const path of [
		"/play",
		"/card",
		"/rounds/new",
		"/progress/",
		"/rounds/new?simulate=1",
	]) {
		const response = await server.fetch(
			new Request(`https://fairway.appelent.nl${path}`),
			{},
			ctx,
		);
		expect(response.status).toBe(301);
		expect(response.headers.get("location")).toBe(
			"https://fairway.appelent.nl/",
		);
	}
	expect(mocks.startFetch).not.toHaveBeenCalled();
});

it("leaves kept and look-alike paths to the app", async () => {
	mocks.startFetch.mockResolvedValue(new Response("ok"));
	for (const path of ["/", "/profile", "/courses", "/rounds", "/players"]) {
		await server.fetch(
			new Request(`https://fairway.appelent.nl${path}`),
			{},
			ctx,
		);
	}
	expect(mocks.startFetch).toHaveBeenCalledTimes(5);
});
