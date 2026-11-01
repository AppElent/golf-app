/**
 * Forwards failed Convex executions — including scheduled and other
 * unattended functions — from `convex logs --jsonl` to Sentry. Best effort:
 * in-memory only, so failures while it is down beyond the replayed history are
 * lost. Needs an always-on host; see docs/runbooks/sentry.md.
 *
 *   pnpm sentry:convex --prod
 *   pnpm sentry:convex --deployment <name>
 *
 * Env: SENTRY_DSN (or VITE_SENTRY_DSN), optional SENTRY_ENVIRONMENT, and
 * Convex CLI auth (a logged-in CLI or a private CONVEX_DEPLOY_KEY).
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import * as Sentry from "@sentry/node";
import { executionErrorEvent } from "./convex-sentry-events.mjs";

const args = process.argv.slice(2);
const deploymentIndex = args.indexOf("--deployment");
const deployment = args.includes("--prod")
	? "production"
	: deploymentIndex >= 0
		? args[deploymentIndex + 1]
		: undefined;
if (!deployment) {
	console.error("Select one deployment: --prod or --deployment <name>.");
	process.exit(1);
}
const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN;
if (!dsn) {
	console.error("Set SENTRY_DSN (or VITE_SENTRY_DSN) to the Fairway DSN.");
	process.exit(1);
}
const environment =
	process.env.SENTRY_ENVIRONMENT ||
	(args.includes("--prod") ? "production" : "development");

Sentry.init({
	dsn,
	environment,
	serverName: deployment,
	defaultIntegrations: false,
	dataCollection: {
		userInfo: false,
		cookies: false,
		httpHeaders: false,
		httpBodies: [],
		urlQueryParams: false,
		stackFrameVariables: false,
	},
	beforeSend(event) {
		delete event.request;
		delete event.extra;
		delete event.user;
		return event;
	},
});

const HISTORY = 100;
const SEEN_LIMIT = 10_000;
const MIN_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

const seen = new Set();
let child;
let stopping = false;
let backoff = MIN_BACKOFF_MS;

function forward(line) {
	let entry;
	try {
		entry = JSON.parse(line);
	} catch {
		return;
	}
	backoff = MIN_BACKOFF_MS;
	const result = executionErrorEvent(entry, { deployment });
	if (!result || seen.has(result.eventId)) return;
	seen.add(result.eventId);
	if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value);
	Sentry.withScope((scope) => {
		scope.addEventProcessor((event) => ({
			...event,
			timestamp: result.timestamp,
		}));
		Sentry.captureException(result.error, {
			event_id: result.eventId,
			tags: result.tags,
		});
	});
}

function start() {
	console.log(`Forwarding Convex failures (${deployment}) to Sentry.`);
	child = spawn(
		"pnpm",
		["exec", "convex", "logs", "--jsonl", "--history", String(HISTORY), ...args],
		{ stdio: ["ignore", "pipe", "inherit"] },
	);
	const lines = createInterface({ input: child.stdout });
	lines.on("line", forward);
	child.on("error", () => console.error("Could not start the Convex log reader."));
	child.on("close", (code) => {
		lines.close();
		if (stopping) return;
		console.error(
			`Convex log reader exited (${code}); reconnecting in ${backoff / 1000}s.`,
		);
		setTimeout(start, backoff);
		backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
	});
}

async function stop() {
	if (stopping) return;
	stopping = true;
	child?.kill("SIGTERM");
	await Sentry.close(5_000);
	process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
start();
