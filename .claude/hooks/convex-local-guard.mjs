#!/usr/bin/env node
// PreToolUse guard for local Convex commands (developer-home standards/convex.md).
// The allow rules in .claude/settings.json only cover commands prefixed with
// CONVEX_AGENT_MODE=anonymous. This hook denies such a command when it could
// reach a cloud deployment, so the allow rules stay local-only.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PREFIX = /^\s*CONVEX_AGENT_MODE=anonymous\s+(?:npx|pnpm\s+exec)\s+convex\b/;
const FORBIDDEN_FLAGS = [
  "--prod",
  "--deployment",
  "--deployment-name",
  "--url",
  "--admin-key",
  "--cloud",
  "--preview-name",
  "--env-file",
];
const LOCAL = /^(?:anonymous|local):/;

function decide(permissionDecision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision,
        permissionDecisionReason: `convex-local-guard: ${reason}`,
      },
    }),
  );
  process.exit(0);
}

const deny = (reason) => decide("deny", reason);

// Variables that select or authenticate a cloud or self-hosted target. Any of
// them can win over CONVEX_DEPLOYMENT, so their presence means "not local".
const CREDENTIALS = [
  "CONVEX_DEPLOY_KEY",
  "CONVEX_DEPLOYMENT_TOKEN",
  "CONVEX_SELF_HOSTED_URL",
  "CONVEX_SELF_HOSTED_ADMIN_KEY",
  "CONVEX_OVERRIDE_ACCESS_TOKEN",
];

function readEnvFile(dir, file) {
  const values = {};
  try {
    for (const line of readFileSync(join(dir, file), "utf8").split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=(.*)$/.exec(line);
      if (!match) continue;
      values[match[1]] = match[2].split("#")[0].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
  return values;
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const command = input?.tool_input?.command;
if (typeof command !== "string" || !PREFIX.test(command)) process.exit(0);

// Only one plain command whose words the shell passes through unchanged: no
// chaining, pipes, subshells, redirects, quoting, escapes, expansions or globs.
// Anything else could hide a flag from the checks below, so it falls back to
// a normal permission prompt.
if (/[;&|`<>'"\\$(){}*?\[\]~!#\n]/.test(command)) {
  decide("ask", "only plain, unquoted Convex commands are auto-allowed.");
}

const words = command.replace(PREFIX, "").trim().split(/\s+/).filter(Boolean);
if (words[0] === "deploy") deny("convex deploy is never auto-allowed. Ask Eric.");
const flag = words.find((word) => FORBIDDEN_FLAGS.some((f) => word === f || word.startsWith(`${f}=`)));
if (flag) deny(`${flag} can select a cloud deployment and is never auto-allowed. Ask Eric.`);

const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
for (const [source, env] of [
  ["the shell", process.env],
  [".env.local", readEnvFile(cwd, ".env.local")],
  [".env", readEnvFile(cwd, ".env")],
]) {
  const deployment = env.CONVEX_DEPLOYMENT;
  if (deployment && !LOCAL.test(deployment)) {
    deny(`CONVEX_DEPLOYMENT in ${source} is "${deployment}", not a local or anonymous deployment. Use a worktree without a cloud .env.local, or ask Eric.`);
  }
  const credential = CREDENTIALS.find((name) => env[name]);
  if (credential) {
    deny(`${credential} is set in ${source}; it can point the CLI at a cloud deployment. Unset it for local work, or ask Eric.`);
  }
}
process.exit(0);
