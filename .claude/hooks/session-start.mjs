#!/usr/bin/env node
// SessionStart hook — cross-platform (Windows local + Linux web containers).
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

// (a) Private GitHub Packages auth — only if a token is provided by the env.
const npmrc = join(homedir(), ".npmrc");
const token = process.env.NODE_AUTH_TOKEN;
const hasAuth =
	existsSync(npmrc) &&
	readFileSync(npmrc, "utf8").includes("//npm.pkg.github.com/:_authToken=");
if (token && !hasAuth) {
	appendFileSync(npmrc, `\n//npm.pkg.github.com/:_authToken=${token}\n`);
}
// (b) Install deps once per fresh container. Skipped locally (node_modules exists).
if (!existsSync("node_modules")) {
	try { execSync("corepack enable", { stdio: "ignore" }); } catch {}
	execSync("pnpm install --frozen-lockfile", { stdio: "inherit" });
}
// (c) Context for the session.
try {
	console.log(`branch: ${execSync("git branch --show-current").toString().trim()}`);
} catch {}
