#!/usr/bin/env node
// SessionStart hook — cross-platform (Windows local + Linux web containers).
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

// (a) Install deps once per fresh container. Skipped locally (node_modules exists).
if (!existsSync("node_modules")) {
	try { execSync("corepack enable", { stdio: "ignore" }); } catch {}
	execSync("pnpm install --frozen-lockfile", { stdio: "inherit" });
}
// (b) Context for the session.
try {
	console.log(`branch: ${execSync("git branch --show-current").toString().trim()}`);
} catch {}
