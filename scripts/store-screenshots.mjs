#!/usr/bin/env node
// App Store screenshots for an app's Expo dev client, the same way in every app.
//
//   cd ~/Developer/<repo>
//   node ~/Developer/developer-home/scripts/store-screenshots.mjs --issue APP-62 [--name arcade]
//        [--devices iphone,ipad] [--langs en,nl] [--keep]
//
// Claims a 6.9" iPhone and a 13" iPad with `~/.agents/bin/sim`, starts this checkout's Metro,
// and for every device and language: sets language, light appearance and a clean status bar,
// reinstalls the dev client, opens it on Metro, and runs the app's Maestro flow
// `apps/mobile/.maestro/store-screenshots.yaml` with the labels from
// `apps/mobile/.maestro/store-screenshots.json`. Every PNG is checked for the store size,
// flattened to RGB, and (iPad) cleared of iPadOS window chrome. Output:
//   ~/Developer/.screenshots/<ISSUE>/<name>/<iphone-6.9|ipad-13>/<en-US|nl-NL>/NN-<screen>.png
//   ~/Developer/.screenshots/<ISSUE>/<name>/contact-<device>.png
// Then it stops its Metro and releases the simulators (unless --keep). Uploading is a separate,
// explicit step (`asc screenshots upload`); see standards/mobile-run.md#store-screenshots.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const SIM = join(homedir(), ".agents/bin/sim");

export const DEVICES = {
	iphone: {
		folder: "iphone-6.9",
		size: [1320, 2868],
		ascType: "IPHONE_67",
		types: ["iPhone 17 Pro Max", "iPhone 16 Pro Max", "iPhone 18 Pro Max"],
	},
	ipad: {
		folder: "ipad-13",
		size: [2064, 2752],
		ascType: "IPAD_PRO_3GEN_129",
		types: ["iPad Pro 13-inch (M5)", "iPad Pro 13-inch (M4)"],
		maskWindowChrome: true,
	},
};
export const LOCALES = { en: { apple: "en", locale: "en_US", store: "en-US" }, nl: { apple: "nl", locale: "nl_NL", store: "nl-NL" } };

// ---------------------------------------------------------------------------
// PNG (8-bit RGB/RGBA, non-interlaced: what simctl and Maestro write)

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
function crc32(buf) {
	let c = 0xffffffff;
	for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

/** Decode to { width, height, channels: 3, data } with alpha flattened onto white. */
export function decodePng(buf) {
	if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error("not a PNG");
	let off = 8;
	let width = 0;
	let height = 0;
	let colorType = 0;
	let hasAlpha = false;
	const idat = [];
	while (off < buf.length) {
		const len = buf.readUInt32BE(off);
		const type = buf.toString("ascii", off + 4, off + 8);
		const body = buf.subarray(off + 8, off + 8 + len);
		if (type === "IHDR") {
			width = body.readUInt32BE(0);
			height = body.readUInt32BE(4);
			colorType = body[9];
			if (body[8] !== 8 || body[12] !== 0 || (colorType !== 2 && colorType !== 6))
				throw new Error("only 8-bit non-interlaced RGB/RGBA PNGs are supported");
			hasAlpha = colorType === 6;
		} else if (type === "IDAT") idat.push(body);
		else if (type === "IEND") break;
		off += 12 + len;
	}
	const bpp = hasAlpha ? 4 : 3;
	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * bpp;
	const px = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		const out = px.subarray(y * stride, (y + 1) * stride);
		const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
		for (let i = 0; i < stride; i++) {
			const a = i >= bpp ? out[i - bpp] : 0;
			const b = prev ? prev[i] : 0;
			const c = prev && i >= bpp ? prev[i - bpp] : 0;
			let v = line[i];
			if (filter === 1) v += a;
			else if (filter === 2) v += b;
			else if (filter === 3) v += (a + b) >> 1;
			else if (filter === 4) {
				const p = a + b - c;
				const pa = Math.abs(p - a);
				const pb = Math.abs(p - b);
				const pc = Math.abs(p - c);
				v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			}
			out[i] = v & 0xff;
		}
	}
	if (!hasAlpha) return { width, height, channels: 3, data: px, hadAlpha: false };
	const rgb = Buffer.alloc(width * height * 3);
	for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
		const al = px[i + 3] / 255;
		for (let k = 0; k < 3; k++) rgb[j + k] = Math.round(px[i + k] * al + 255 * (1 - al));
	}
	return { width, height, channels: 3, data: rgb, hadAlpha: true };
}

/** Encode RGB pixels as a PNG without alpha (App Store Connect rejects alpha). */
export function encodePng({ width, height, data }) {
	const stride = width * 3;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (stride + 1)] = 2; // "up" filter compresses screenshots well
		for (let i = 0; i < stride; i++) {
			const cur = data[y * stride + i];
			const up = y > 0 ? data[(y - 1) * stride + i] : 0;
			raw[y * (stride + 1) + 1 + i] = (cur - up) & 0xff;
		}
	}
	const chunk = (type, body) => {
		const head = Buffer.alloc(8);
		head.writeUInt32BE(body.length, 0);
		head.write(type, 4, "ascii");
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
		return Buffer.concat([head, body, crc]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	return Buffer.concat([PNG_SIG, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * iPadOS windowing draws the app name next to the date in the status bar and a resize grabber in the
 * bottom-right corner. Both are system chrome, not the app: paint them over with the background around them.
 */
export function maskIpadWindowChrome(img) {
	const { width: W, height: H, data } = img;
	const at = (x, y) => (y * W + x) * 3;
	const fillRow = (y, x0, x1, s0, s1) => {
		const a = data.subarray(at(s0, y), at(s0, y) + 3);
		const b = data.subarray(at(Math.min(s1, W - 1), y), at(Math.min(s1, W - 1), y) + 3);
		const ca = [...a];
		const cb = [...b];
		for (let x = x0; x < x1; x++) {
			const t = (x - x0) / Math.max(1, x1 - x0);
			for (let k = 0; k < 3; k++) data[at(x, y) + k] = Math.round(ca[k] * (1 - t) + cb[k] * t);
		}
	};
	// Status bar text sits in y 10..80; words are split by gaps under 22px, items by wider gaps.
	const ink = [];
	for (let x = 0; x < Math.min(1100, W); x++) {
		let hit = false;
		for (let y = 10; y < 80 && !hit; y++) {
			const p = at(x, y);
			const q = at(x, 4);
			if (Math.abs(data[p] - data[q]) + Math.abs(data[p + 1] - data[q + 1]) + Math.abs(data[p + 2] - data[q + 2]) > 120) hit = true;
		}
		ink.push(hit);
	}
	const groups = [];
	let start = -1;
	let last = -100;
	ink.forEach((hit, x) => {
		if (!hit) return;
		if (x - last > 22) {
			if (start >= 0) groups.push([start, last]);
			start = x;
		}
		last = x;
	});
	if (start >= 0) groups.push([start, last]);
	if (groups.length < 3) throw new Error(`expected time, date and app name in the iPad status bar, found ${groups.length} items`);
	const [a0, a1] = groups.at(-1);
	for (let y = 0; y < 100; y++) fillRow(y, a0 - 6, a1 + 8, a0 - 10, a1 + 12);
	for (let y = H - 130; y < H; y++) fillRow(y, W - 130, W, W - 136, W - 136);
	return img;
}

/** One contact sheet: a row per folder, thumbnails `thumbW` wide (box-filtered). */
export function contactSheet(rows, thumbW = 300, gap = 16) {
	const imgs = rows.map((files) => files.map((f) => decodePng(readFileSync(f))));
	const first = imgs.flat()[0];
	const thumbH = Math.round((thumbW * first.height) / first.width);
	const cols = Math.max(...imgs.map((r) => r.length));
	const W = gap + cols * (thumbW + gap);
	const H = gap + imgs.length * (thumbH + gap);
	const data = Buffer.alloc(W * H * 3, 0xd0);
	imgs.forEach((row, r) =>
		row.forEach((img, c) => {
			const sx = img.width / thumbW;
			const sy = img.height / thumbH;
			for (let ty = 0; ty < thumbH; ty++)
				for (let tx = 0; tx < thumbW; tx++) {
					const sum = [0, 0, 0];
					let n = 0;
					for (let y = Math.floor(ty * sy); y < Math.floor((ty + 1) * sy); y++)
						for (let x = Math.floor(tx * sx); x < Math.floor((tx + 1) * sx); x++) {
							const p = (y * img.width + x) * 3;
							sum[0] += img.data[p];
							sum[1] += img.data[p + 1];
							sum[2] += img.data[p + 2];
							n++;
						}
					const o = ((gap + r * (thumbH + gap) + ty) * W + gap + c * (thumbW + gap) + tx) * 3;
					for (let k = 0; k < 3; k++) data[o + k] = Math.round(sum[k] / Math.max(1, n));
				}
		}),
	);
	return encodePng({ width: W, height: H, data });
}

// ---------------------------------------------------------------------------
// Side effects

const log = (msg) => process.stderr.write(`[store-screenshots] ${msg}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function run(cmd, args, opts = {}) {
	const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
	return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, stdout: r.stdout ?? "" };
}
const simctl = (...args) => run("xcrun", ["simctl", ...args]);

const claimed = [];
let metro = null;
function cleanup(keep) {
	if (metro) {
		try {
			process.kill(-metro.pid, "SIGTERM");
		} catch {}
		log(`stopped Metro on :${metro.port}`);
		metro = null;
	}
	if (keep) {
		if (claimed.length) log(`kept simulators: ${claimed.join(" ")} (release with ${SIM} release <udid>)`);
		return;
	}
	for (const udid of claimed.splice(0)) {
		const r = run(SIM, ["release", udid]);
		log(r.ok ? `released ${udid}` : `sim release ${udid} failed: ${r.out.trim()}`);
	}
}

function parseArgs(argv) {
	const opts = { devices: ["iphone", "ipad"], langs: ["en", "nl"], keep: false, issue: "", name: "" };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--issue") opts.issue = argv[++i];
		else if (a === "--name") opts.name = argv[++i];
		else if (a === "--devices") opts.devices = argv[++i].split(",");
		else if (a === "--langs") opts.langs = argv[++i].split(",");
		else if (a === "--keep") opts.keep = true;
		else throw new Error(`unknown flag ${a}`);
	}
	if (!/^[A-Z]+-\d+$/.test(opts.issue)) throw new Error("--issue APP-123 is required (output goes to ~/Developer/.screenshots/<ISSUE>/)");
	for (const d of opts.devices) if (!DEVICES[d]) throw new Error(`unknown device ${d} (iphone, ipad)`);
	for (const l of opts.langs) if (!LOCALES[l]) throw new Error(`unknown language ${l} (en, nl)`);
	return opts;
}

function findDevClient(repo, bundleId) {
	if (process.env.RUN_MOBILE_APP) return process.env.RUN_MOBILE_APP;
	const candidates = [];
	const scan = (dir, depth) => {
		if (depth < 0 || !existsSync(dir)) return;
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			if (!e.isDirectory()) continue;
			const p = join(dir, e.name);
			if (e.name.endsWith(".app")) candidates.push(p);
			else scan(p, depth - 1);
		}
	};
	const derived = join(homedir(), "Library/Developer/Xcode/DerivedData");
	if (existsSync(derived)) for (const d of readdirSync(derived)) scan(join(derived, d, "Build/Products/Debug-iphonesimulator"), 0);
	scan(join(homedir(), "Developer/.builds", basename(repo)), 4);
	const matching = candidates.filter((app) => run("plutil", ["-extract", "CFBundleIdentifier", "raw", join(app, "Info.plist")]).stdout.trim() === bundleId);
	matching.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
	return matching[0] ?? "";
}

function deviceType(names) {
	const types = JSON.parse(simctl("list", "devicetypes", "-j").stdout).devicetypes.map((t) => t.name);
	const found = names.find((n) => types.includes(n));
	if (!found) throw new Error(`none of these simulator device types is installed: ${names.join(", ")}`);
	return found;
}

function listenerPid(port) {
	return run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]).stdout.split("\n")[0].trim();
}

async function startMetro(mobile, basePort, logFile) {
	let port = basePort;
	while (listenerPid(port) && port < basePort + 20) port++;
	if (listenerPid(port)) throw new Error(`ports ${basePort}-${basePort + 20} are all taken`);
	log(`starting Metro on :${port} (log: ${logFile})`);
	const out = openSync(logFile, "w");
	const child = spawn("pnpm", ["exec", "expo", "start", "--dev-client", "--port", String(port)], {
		cwd: mobile,
		detached: true,
		stdio: ["ignore", out, out],
	});
	child.unref();
	metro = { pid: child.pid, port };
	for (let i = 0; i < 90; i++) {
		try {
			if ((await (await fetch(`http://127.0.0.1:${port}/status`)).text()).includes("running")) return port;
		} catch {}
		await sleep(1000);
	}
	throw new Error(`Metro did not come up; see ${logFile}`);
}

async function waitState(udid, state) {
	for (let i = 0; i < 60; i++) {
		const d = Object.values(JSON.parse(simctl("list", "devices", "-j").stdout).devices)
			.flat()
			.find((x) => x.udid === udid);
		if (d?.state === state) return;
		await sleep(1000);
	}
	throw new Error(`${udid} did not reach ${state}`);
}

function maestro(udid, args) {
	return run("maestro", ["--device", udid, "test", ...args], { maxBuffer: 64 * 1024 * 1024 });
}

async function prepare(udid, lang, ctx) {
	const loc = LOCALES[lang];
	simctl("bootstatus", udid, "-b");
	simctl("spawn", udid, "defaults", "write", "-g", "AppleLanguages", "-array", loc.apple);
	simctl("spawn", udid, "defaults", "write", "-g", "AppleLocale", "-string", loc.locale);
	simctl("shutdown", udid);
	await waitState(udid, "Shutdown");
	simctl("boot", udid);
	simctl("bootstatus", udid, "-b");
	simctl("ui", udid, "appearance", "light");
	// prettier-ignore
	simctl("status_bar", udid, "override", "--time", "9:41", "--dataNetwork", "wifi", "--wifiBars", "3", "--cellularMode", "active", "--cellularBars", "4", "--batteryState", "charged", "--batteryLevel", "100");
	// A fresh install drops most saved games; the flow must still cope with state that survives (keychain).
	simctl("uninstall", udid, ctx.bundleId);
	const inst = simctl("install", udid, ctx.app);
	if (!inst.ok) throw new Error(`install failed: ${inst.out.trim()}`);
	const url = `${ctx.bundleId}://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${ctx.port}`)}&disableOnboarding=1&disableFab=1&disableAutoLaunch=1`;
	simctl("openurl", udid, url);
	await sleep(2000);
	// iOS asks "Open in <app>?"; the button is "Open" in English and Dutch.
	const accept = join(ctx.tmp, "accept.yaml");
	writeFileSync(accept, `appId: ${ctx.bundleId}\n---\n- tapOn:\n    text: "Open"\n    optional: true\n`);
	maestro(udid, [accept]);
}

async function capture(device, udid, lang, ctx) {
	const spec = DEVICES[device];
	const loc = LOCALES[lang];
	const labels = ctx.flowConfig.languages?.[lang];
	if (!labels) throw new Error(`.maestro/store-screenshots.json has no labels for "${lang}"`);
	log(`${device} ${loc.store}: preparing`);
	await prepare(udid, lang, ctx);
	const raw = join(ctx.tmp, `${device}-${lang}`);
	rmSync(raw, { recursive: true, force: true });
	const env = Object.entries(labels).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
	log(`${device} ${loc.store}: running the Maestro flow`);
	const r = maestro(udid, ["--test-output-dir", raw, ...env, ctx.flow]);
	if (!r.ok) throw new Error(`Maestro flow failed on ${device} ${loc.store} (artifacts: ${raw}):\n${r.out.split("\n").slice(-12).join("\n")}`);
	const shots = [];
	const walk = (dir) => {
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			const p = join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else if (dir.endsWith("takeScreenshot") && e.name.endsWith(".png")) shots.push(p);
		}
	};
	walk(raw);
	if (!shots.length) throw new Error(`the flow took no screenshots (${raw})`);
	const outDir = join(ctx.out, spec.folder, loc.store);
	rmSync(outDir, { recursive: true, force: true });
	mkdirSync(outDir, { recursive: true });
	for (const shot of shots.sort()) {
		const img = decodePng(readFileSync(shot));
		if (img.width !== spec.size[0] || img.height !== spec.size[1])
			throw new Error(`${basename(shot)} is ${img.width}x${img.height}, expected ${spec.size.join("x")}`);
		if (spec.maskWindowChrome) maskIpadWindowChrome(img);
		writeFileSync(join(outDir, basename(shot)), encodePng(img));
	}
	log(`${device} ${loc.store}: ${shots.length} screenshots in ${outDir}`);
}

async function main(argv) {
	const opts = parseArgs(argv);
	const repo = resolve(process.cwd());
	const mobile = join(repo, "apps/mobile");
	const pkg = JSON.parse(readFileSync(join(mobile, "package.json"), "utf8"));
	const { bundleId, port: basePort } = pkg.runMobile ?? {};
	if (!bundleId || !basePort) throw new Error('apps/mobile/package.json needs "runMobile": { "bundleId", "port" }');
	const flow = join(mobile, ".maestro/store-screenshots.yaml");
	const flowConfigPath = join(mobile, ".maestro/store-screenshots.json");
	if (!existsSync(flow) || !existsSync(flowConfigPath)) throw new Error("missing apps/mobile/.maestro/store-screenshots.yaml or .json");
	const app = findDevClient(repo, bundleId);
	if (!app) throw new Error(`no dev client build for ${bundleId}; build one or set RUN_MOBILE_APP`);
	const name = opts.name || basename(repo);
	const out = join(homedir(), "Developer/.screenshots", opts.issue, name);
	const tmp = join(tmpdir(), `store-screenshots-${process.pid}`);
	mkdirSync(tmp, { recursive: true });
	const ctx = { bundleId, app, flow, flowConfig: JSON.parse(readFileSync(flowConfigPath, "utf8")), out, tmp, port: 0 };

	const stop = () => {
		cleanup(opts.keep);
		process.exit(130);
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	try {
		ctx.port = await startMetro(mobile, basePort, join(tmp, "metro.log"));
		const udids = {};
		for (const device of opts.devices) {
			const type = deviceType(DEVICES[device].types);
			const r = run(SIM, ["claim", "ios", `store-${device}`, type], { cwd: repo });
			const udid = r.stdout.trim().split("\n").at(-1);
			if (!r.ok || !/^[0-9A-F-]{36}$/.test(udid)) throw new Error(`sim claim failed: ${r.out.trim()}`);
			claimed.push(udid);
			udids[device] = udid;
			log(`claimed ${type} (${udid})`);
		}
		// Devices run in parallel; languages run one after another on each device.
		await Promise.all(opts.devices.map(async (device) => {
			for (const lang of opts.langs) await capture(device, udids[device], lang, ctx);
		}));
		for (const device of opts.devices) {
			const spec = DEVICES[device];
			const rows = opts.langs
				.map((l) => join(out, spec.folder, LOCALES[l].store))
				.map((d) => readdirSync(d).filter((f) => f.endsWith(".png")).sort().map((f) => join(d, f)));
			const sheet = join(out, `contact-${spec.folder}.png`);
			writeFileSync(sheet, contactSheet(rows));
			log(`contact sheet ${sheet}`);
		}
		log(`done. Upload per locale: asc screenshots upload --version-localization <ID> --path ${out}/<device>/<locale> --device-type ${DEVICES.iphone.ascType}|${DEVICES.ipad.ascType}`);
	} finally {
		cleanup(opts.keep);
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	main(process.argv.slice(2)).catch((e) => {
		log(`ERROR: ${e.message}`);
		process.exit(1);
	});
