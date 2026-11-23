#!/usr/bin/env node
// Run and drive an app's Expo dev client on an iOS simulator, the same way in
// every AppElent app. Synced from AppElent/developer-home; see
// docs/standards/mobile-run.md. Do not edit in an app.
//
//   node scripts/run-mobile.mjs up [--lang en|nl] [--clear] [--env KEY=VALUE]
//   node scripts/run-mobile.mjs signin [--email E --password P]
//   node scripts/run-mobile.mjs ad <agent-device args>
//   node scripts/run-mobile.mjs ss [file] | reload | logs [n] | backend | udid | state | down
//
// Config: `runMobile` in apps/mobile/package.json, for example
//   "runMobile": { "bundleId": "com.appelent.foundry.dev", "port": 8090 }
//
// The simulator always comes from `~/.agents/bin/sim claim ios run-<checkout>`
// (named `agent-<checkout folder>-run-<checkout id>`) and goes back with `sim release` on
// `down`. Drive it only through this script or Bash with its UDID, never with
// the Claude desktop app's iOS Simulator tool (it asks Eric for every device).
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const AGENT_DEVICE = ["-y", "agent-device@0.21.27"];
const SIM = join(homedir(), ".agents/bin/sim");

// ---------------------------------------------------------------------------
// Pure helpers (tested in developer-home tests/run-mobile.test.mjs)

/** The sign-in button's label in every app language `up --lang` offers. */
export const SIGN_IN_LABELS = ["Sign in", "Inloggen"];

/**
 * An agent-device selector for the sign-in submit button in any app language:
 * the `sign-in-submit` testID where the app sets it, else an element whose
 * label is one of SIGN_IN_LABELS (`||` is agent-device's fallback chain).
 */
export function signInSelector(labels = SIGN_IN_LABELS) {
	return ['id="sign-in-submit"', ...labels.map((label) => `label=${JSON.stringify(label)}`)].join(" || ");
}

/** Stable 8-character id for a checkout path. */
export function checkoutId(dir) {
	return createHash("sha1").update(dir).digest("hex").slice(0, 8);
}

/** The simulator name `sim claim ios run-<id>` creates, as a matcher (repo slug is sim's business). */
export function isRunSimulator(name, id) {
	return name.startsWith("agent-") && name.endsWith(`-run-${id}`);
}

/** Minimal dotenv parser: KEY=VALUE lines, optional quotes, `#` comments. */
export function parseEnv(text) {
	const out = {};
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
		if (!match) continue;
		let value = match[2].trim();
		if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
		else value = value.replace(/\s+#.*$/, "");
		out[match[1]] = value;
	}
	return out;
}

const INLINED_URL = /"EXPO_PUBLIC_CONVEX_URL":\s*(?:\{[^}]*?value:\s*)?"(https?:\/\/[^"\s]+)"/g;

function origin(url) {
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
}

/** Origins the bundle inlines for `EXPO_PUBLIC_CONVEX_URL`, and nothing else (bundles inline test passwords). */
export function bundleConvexOrigins(bundle) {
	return [...new Set([...bundle.matchAll(INLINED_URL)].map((m) => origin(m[1])).filter(Boolean))].sort();
}

/** `expected` maps a source label to a configured Convex URL. Every source and the bundle must name one deployment. */
export function compareBackends({ expected, bundle }) {
	const configured = Object.entries(expected)
		.filter(([, url]) => url)
		.map(([source, url]) => ({ source, origin: origin(url) }));
	const inlined = bundleConvexOrigins(bundle);
	const problems = [];
	for (const { source, origin: value } of configured) if (!value) problems.push(`${source} is not a valid URL`);
	const target = configured.find(({ origin: value }) => value)?.origin;
	if (!target) problems.push("no EXPO_PUBLIC_CONVEX_URL configured");
	for (const { source, origin: value } of configured)
		if (value && target && value !== target) problems.push(`${source} names ${value}, expected ${target}`);
	if (inlined.length === 0) problems.push("bundle does not inline EXPO_PUBLIC_CONVEX_URL");
	for (const value of inlined) if (target && value !== target) problems.push(`bundle uses ${value}, expected ${target}`);
	return { ok: problems.length === 0, target, bundle: inlined, problems };
}

/** Validated `runMobile` config from apps/mobile/package.json. */
export function readConfig(pkg) {
	const config = pkg.runMobile;
	if (!config || typeof config.bundleId !== "string" || !Number.isInteger(config.port))
		throw new Error('apps/mobile/package.json needs "runMobile": { "bundleId": "<id>.dev", "port": <number> }');
	return { bundleId: config.bundleId, port: config.port };
}

// ---------------------------------------------------------------------------
// Side effects

const log = (msg) => process.stderr.write(`[run-mobile] ${msg}\n`);
let claimed = "";
function die(msg) {
	log(`ERROR: ${msg}`);
	if (claimed) log(`simulator '${claimed}' stays claimed; run: node scripts/run-mobile.mjs down`);
	process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args, opts = {}) {
	const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
	return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, stdout: r.stdout ?? "" };
}
const simctl = (...args) => run("xcrun", ["simctl", ...args]);

function context() {
	const repo = resolve(fileURLToPath(import.meta.url), "../..");
	const mobile = join(repo, "apps/mobile");
	const pkgPath = join(mobile, "package.json");
	if (!existsSync(pkgPath)) die(`no apps/mobile/package.json under ${repo}`);
	const config = readConfig(JSON.parse(readFileSync(pkgPath, "utf8")));
	const id = checkoutId(mobile);
	const state = process.env.RUN_MOBILE_STATE || join(tmpdir(), `run-mobile-${id}`);
	mkdirSync(state, { recursive: true });
	// `up` moves to a free port when another checkout's Metro holds the app's port; later commands reuse it.
	const portFile = join(state, "port");
	const saved = existsSync(portFile) ? Number(readFileSync(portFile, "utf8")) : 0;
	const port = Number(process.env.RUN_MOBILE_PORT || saved || config.port);
	return { repo, mobile, id, port, portFile, state, bundleId: config.bundleId, pinned: Boolean(process.env.RUN_MOBILE_PORT) };
}

function devices() {
	const r = simctl("list", "devices", "-j");
	if (!r.ok) die(`simctl list failed: ${r.out.trim()}`);
	return Object.values(JSON.parse(r.stdout).devices).flat();
}
function findUdid(ctx) {
	return devices().find((d) => d.isAvailable && isRunSimulator(d.name, ctx.id))?.udid ?? "";
}
function requireUdid(ctx) {
	const u = findUdid(ctx);
	if (!u) die("no simulator claimed for this checkout; run: node scripts/run-mobile.mjs up");
	return u;
}

/** agent-device keys sessions by cwd, so always run it from the state dir. */
function ad(ctx, args, { quiet = false } = {}) {
	const r = run("npx", [...AGENT_DEVICE, ...args], { cwd: ctx.state });
	const out = r.out
		.split("\n")
		.filter((l) => !l.startsWith("npm notice"))
		.join("\n");
	if (!quiet && out.trim()) process.stdout.write(out.endsWith("\n") ? out : `${out}\n`);
	return { ok: r.ok, out };
}

function findDevClient(ctx) {
	if (process.env.RUN_MOBILE_APP) return process.env.RUN_MOBILE_APP;
	const candidates = [];
	const derived = join(homedir(), "Library/Developer/Xcode/DerivedData");
	const repoName = ctx.repo.split("/").at(-1);
	const builds = join(homedir(), "Developer/.builds", repoName);
	const scan = (dir, depth) => {
		if (depth < 0 || !existsSync(dir)) return;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (!entry.isDirectory()) continue;
			if (entry.name.endsWith(".app")) candidates.push(path);
			else scan(path, depth - 1);
		}
	};
	if (existsSync(derived))
		for (const d of readdirSync(derived)) scan(join(derived, d, "Build/Products/Debug-iphonesimulator"), 0);
	scan(builds, 4);
	const matching = candidates.filter((app) => {
		const r = run("plutil", ["-extract", "CFBundleIdentifier", "raw", join(app, "Info.plist")]);
		return r.ok && r.stdout.trim() === ctx.bundleId;
	});
	matching.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
	return matching[0] ?? "";
}

function metroCwd(port) {
	const pid = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]).stdout.split("\n")[0].trim();
	if (!pid) return "";
	const line = run("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"]).stdout.split("\n").find((l) => l.startsWith("n"));
	return line ? line.slice(1) : "";
}

async function ensureMetro(ctx, { clear, env }) {
	let cwd = metroCwd(ctx.port);
	if (cwd && cwd !== ctx.mobile && !ctx.pinned) {
		const taken = ctx.port;
		for (let p = taken + 1; p <= taken + 20; p++) {
			const owner = metroCwd(p);
			if (!owner || owner === ctx.mobile) {
				ctx.port = p;
				cwd = owner;
				break;
			}
		}
		if (ctx.port === taken) die(`ports ${taken}-${taken + 20} are all Metro for other checkouts; set RUN_MOBILE_PORT`);
		log(`port ${taken} is Metro for another checkout; using ${ctx.port}`);
	}
	writeFileSync(ctx.portFile, String(ctx.port));
	if (cwd) {
		if (cwd !== ctx.mobile) die(`port ${ctx.port} is Metro for ${cwd}, not this checkout; unset RUN_MOBILE_PORT or pick another`);
		if (clear || Object.keys(env).length) die("Metro is already running; run down, then up with these flags");
		log(`reusing Metro on :${ctx.port}`);
		return;
	}
	log(`starting Metro on :${ctx.port} (log: ${join(ctx.state, "metro.log")})`);
	const out = openSync(join(ctx.state, "metro.log"), "w");
	const args = ["exec", "expo", "start", "--dev-client", "--port", String(ctx.port), ...(clear ? ["--clear"] : [])];
	const child = spawn("pnpm", args, { cwd: ctx.mobile, detached: true, stdio: ["ignore", out, out], env: { ...process.env, ...env } });
	child.unref();
	writeFileSync(join(ctx.state, "metro.pid"), String(child.pid));
	for (let i = 0; i < 90; i++) {
		try {
			const r = await fetch(`http://127.0.0.1:${ctx.port}/status`);
			if ((await r.text()).includes("running")) {
				const listener = run("lsof", ["-nP", `-iTCP:${ctx.port}`, "-sTCP:LISTEN", "-t"]).stdout.split("\n")[0].trim();
				writeFileSync(join(ctx.state, "metro.listener"), listener);
				return;
			}
		} catch {}
		await sleep(1000);
	}
	die(`Metro did not come up; see ${join(ctx.state, "metro.log")}`);
}

function claim(ctx) {
	const found = devices().find((d) => d.isAvailable && isRunSimulator(d.name, ctx.id));
	if (found) {
		claimed = found.name;
		log(`reusing simulator '${found.name}' (${found.udid})`);
		return { udid: found.udid, fresh: false };
	}
	if (!existsSync(SIM)) die(`${SIM} is missing; it hands out agent simulators on the Mac`);
	log(`claiming a simulator (sim claim ios run-${ctx.id})`);
	const r = run(SIM, ["claim", "ios", `run-${ctx.id}`], { cwd: ctx.repo });
	if (!r.ok) die(`sim claim failed: ${r.out.trim()}`);
	const made = devices().find((d) => d.isAvailable && isRunSimulator(d.name, ctx.id));
	if (!made) die(`sim claim did not create agent-*-run-${ctx.id}: ${r.out.trim()}`);
	claimed = made.name;
	log(`claimed simulator '${made.name}' (${made.udid})`);
	return { udid: made.udid, fresh: true };
}

function setLang(udid, lang) {
	const locale = { en: "en_US", nl: "nl_NL" }[lang];
	if (!locale) die("--lang must be en or nl");
	simctl("spawn", udid, "defaults", "write", "-g", "AppleLanguages", "-array", lang);
	simctl("spawn", udid, "defaults", "write", "-g", "AppleLocale", "-string", locale);
}

async function waitState(udid, state) {
	for (let i = 0; i < 30; i++) {
		if (devices().find((d) => d.udid === udid)?.state === state) return;
		await sleep(1000);
	}
}

function envFiles(ctx) {
	const read = (p) => (existsSync(p) ? parseEnv(readFileSync(p, "utf8")).EXPO_PUBLIC_CONVEX_URL : undefined);
	return {
		"apps/mobile/.env.local": read(join(ctx.mobile, ".env.local")),
		"apps/mobile/.env": read(join(ctx.mobile, ".env")),
	};
}

async function cmdBackend(ctx) {
	let bundle;
	try {
		const r = await fetch(`http://127.0.0.1:${ctx.port}/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&lazy=false&minify=false`);
		if (!r.ok) throw new Error(`Metro returned ${r.status}`);
		bundle = await r.text();
	} catch (error) {
		log(`no bundle from Metro on :${ctx.port} (${error.message})`);
		return false;
	}
	const result = compareBackends({ expected: envFiles(ctx), bundle });
	log(`backend: ${result.target ?? "?"}; bundle: ${result.bundle.join(", ") || "none"}`);
	for (const p of result.problems) log(`  ${p}`);
	return result.ok;
}

async function cmdUp(ctx, args) {
	let lang = "en";
	let clear = false;
	const env = {};
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--lang") lang = args[++i];
		else if (args[i] === "--clear") clear = true;
		else if (args[i] === "--env") {
			const [k, ...v] = (args[++i] ?? "").split("=");
			if (!k) die("--env needs KEY=VALUE");
			env[k] = v.join("=");
		} else die(`up: unknown flag ${args[i]}`);
	}
	const { udid, fresh } = claim(ctx);
	const langFile = join(ctx.state, "lang");
	if (fresh || (existsSync(langFile) ? readFileSync(langFile, "utf8").trim() : "") !== lang) {
		simctl("boot", udid);
		simctl("bootstatus", udid, "-b");
		setLang(udid, lang);
		simctl("shutdown", udid);
		await waitState(udid, "Shutdown");
		writeFileSync(langFile, lang);
	}
	simctl("boot", udid);
	simctl("bootstatus", udid, "-b");
	if (!simctl("get_app_container", udid, ctx.bundleId).ok) {
		const app = findDevClient(ctx);
		if (!app) die(`no dev client build for ${ctx.bundleId}; build one (pnpm devbuild:ios or expo run:ios) or set RUN_MOBILE_APP`);
		log(`installing ${app}`);
		const r = simctl("install", udid, app);
		if (!r.ok) die(`install failed: ${r.out.trim()}`);
	}
	await ensureMetro(ctx, { clear, env });
	simctl("terminate", udid, ctx.bundleId);
	const metroLog = join(ctx.state, "metro.log");
	const bundled = () => (existsSync(metroLog) ? (readFileSync(metroLog, "utf8").match(/iOS Bundled/g) ?? []).length : 0);
	const before = bundled();
	// expo-dev-launcher flags: skip the dev-menu onboarding sheet and the floating gear over header buttons.
	const url = `${ctx.bundleId}://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${ctx.port}`)}&disableOnboarding=1&disableFab=1&disableAutoLaunch=1`;
	simctl("openurl", udid, url);
	ad(ctx, ["alert", "accept", "5000", "--platform", "ios", "--udid", udid], { quiet: true });
	let open = ad(ctx, ["open", ctx.bundleId, "--platform", "ios", "--udid", udid], { quiet: true });
	if (!open.ok) {
		const owner = /close --session ([^ .,"]+)/.exec(open.out)?.[1];
		if (!owner) die(`agent-device open failed: ${open.out.trim()}`);
		log(`simulator held by stale session '${owner}'; closing it`);
		ad(ctx, ["close", "--session", owner], { quiet: true });
		open = ad(ctx, ["open", ctx.bundleId, "--platform", "ios", "--udid", udid], { quiet: true });
		if (!open.ok) die("agent-device open failed after closing the stale session");
	}
	log("waiting for the iOS bundle (max 180s)");
	let ok = false;
	for (let i = 0; i < 90; i++) {
		if (bundled() > before) {
			ok = true;
			break;
		}
		if (existsSync(metroLog) && /Bundling failed|PluginError|Unable to resolve/.test(readFileSync(metroLog, "utf8")))
			die(`Metro error; see ${metroLog} (stale Metro? down, then up --clear)`);
		await sleep(2000);
	}
	if (!ok) die(`no new iOS bundle after 180s; see ${metroLog}`);
	if (!(await cmdBackend(ctx))) die("the app is not on the configured backend; make no writes");
	await sleep(3000);
	log(`up: simulator='${claimed}' udid=${udid} port=${ctx.port} lang=${lang}`);
}

function cmdSignin(ctx, args) {
	let email = "";
	let password = "";
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--email") email = args[++i] ?? "";
		else if (args[i] === "--password") password = args[++i] ?? "";
		else die(`signin: unknown option ${args[i]}`);
	}
	if (Boolean(email) !== Boolean(password)) die("signin: --email and --password go together");
	const submit = signInSelector();
	if (!ad(ctx, ["wait", submit, "20000"], { quiet: true }).ok) die("sign-in screen not visible (already signed in?)");
	if (email) {
		const ref = (kind) => new RegExp(`\\[${kind}\\][^\\n]*?(@e\\d+)|(@e\\d+)[^\\n]*\\[${kind}\\]`).exec(ad(ctx, ["snapshot", "-i"], { quiet: true }).out);
		const field = ref("text-field");
		if (!field || !ad(ctx, ["fill", field[1] ?? field[2], email], { quiet: true }).ok) die("could not fill email");
		const secure = ref("securetextfield");
		if (!secure || !ad(ctx, ["fill", secure[1] ?? secure[2], password], { quiet: true }).ok) die("could not fill password");
		if (!ad(ctx, ["snapshot", "-i"], { quiet: true }).out.includes(`"${email}"`)) die(`email field does not show ${email}; not signing in`);
	}
	ad(ctx, ["press", submit], { quiet: true });
	if (!ad(ctx, ["wait", "role=tab-bar", "30000"], { quiet: true }).ok) die("tab bar not visible after sign-in");
	log("signed in");
}

function cmdDown(ctx) {
	ad(ctx, ["close"], { quiet: true });
	const pidFile = join(ctx.state, "metro.pid");
	if (existsSync(pidFile)) {
		const pid = Number(readFileSync(pidFile, "utf8"));
		try {
			process.kill(-pid);
		} catch {}
		rmSync(pidFile, { force: true });
	}
	const listenerFile = join(ctx.state, "metro.listener");
	if (existsSync(listenerFile)) {
		const pid = readFileSync(listenerFile, "utf8").trim();
		const owners = run("lsof", ["-nP", `-iTCP:${ctx.port}`, "-sTCP:LISTEN", "-t"]).stdout.split("\n").map((s) => s.trim());
		if (pid && owners.includes(pid))
			try {
				process.kill(Number(pid));
			} catch {}
		rmSync(listenerFile, { force: true });
	}
	const u = findUdid(ctx);
	if (u) {
		const r = run(SIM, ["release", u]);
		if (!r.ok) log(`sim release failed: ${r.out.trim()}`);
		else log(`released simulator ${u}`);
		rmSync(join(ctx.state, "lang"), { force: true });
	}
	rmSync(ctx.portFile, { force: true });
	log("down");
}

async function main(argv) {
	const [cmd, ...args] = argv;
	const ctx = context();
	switch (cmd) {
		case "up":
			return cmdUp(ctx, args);
		case "signin":
			return cmdSignin(ctx, args);
		case "ad":
			process.exitCode = ad(ctx, args).ok ? 0 : 1;
			return;
		case "ss": {
			const out = args[0] ?? join(ctx.state, `screen-${Date.now()}.png`);
			const r = simctl("io", requireUdid(ctx), "screenshot", out);
			if (!r.ok) die(`screenshot failed: ${r.out.trim()}`);
			console.log(out);
			return;
		}
		case "reload": {
			const r = await fetch(`http://127.0.0.1:${ctx.port}/reload`, { method: "POST" }).catch(() => null);
			if (!r?.ok) die(`Metro not reachable on :${ctx.port}`);
			log("reload sent");
			return;
		}
		case "logs": {
			const p = join(ctx.state, "metro.log");
			if (existsSync(p)) console.log(readFileSync(p, "utf8").split("\n").slice(-Number(args[0] ?? 40)).join("\n"));
			return;
		}
		case "backend":
			process.exitCode = (await cmdBackend(ctx)) ? 0 : 1;
			return;
		case "udid":
			console.log(requireUdid(ctx));
			return;
		case "state":
			console.log(ctx.state);
			return;
		case "down":
			return cmdDown(ctx);
		default:
			console.log("commands: up [--lang en|nl] [--clear] [--env KEY=VALUE] | signin [--email E --password P] | ad <args> | ss [file] | reload | logs [n] | backend | udid | state | down");
			process.exitCode = 2;
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
