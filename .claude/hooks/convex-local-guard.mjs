#!/usr/bin/env node
// PreToolUse guard for local Convex commands (developer-home standards/convex.md).
// The allow rules in .claude/settings.json only cover commands prefixed with
// CONVEX_AGENT_MODE=anonymous. This hook keeps them local-only: it lets through
// an allowlisted command shape against a local or anonymous deployment, sends
// any other shape back to a normal permission prompt, and denies commands that
// would reach a cloud deployment.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PREFIX = /^\s*CONVEX_AGENT_MODE=anonymous\s+(?:npx|pnpm\s+exec)\s+convex\b/;
const LOCAL = /^(?:anonymous|local):/;
// Variables that select or authenticate a cloud or self-hosted target. Any of
// them can win over CONVEX_DEPLOYMENT, so their presence means "not local".
const CREDENTIALS = [
  "CONVEX_DEPLOY_KEY",
  "CONVEX_DEPLOYMENT_TOKEN",
  "CONVEX_SELF_HOSTED_URL",
  "CONVEX_SELF_HOSTED_ADMIN_KEY",
  "CONVEX_OVERRIDE_ACCESS_TOKEN",
];
// `convex dev` flags that only change local behaviour. Anything else (for
// example --configure, --prod, --env-file, --start, --run-sh) needs a prompt.
const DEV_FLAGS = /^--(?:once|until-success|verbose|tail-logs(?:=[a-z-]+)?|typecheck=(?:enable|try|disable)|codegen=(?:enable|disable))$/;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
const ask = (reason) => decide("ask", reason);

function allowedShape(words) {
  const [command, sub, ...rest] = words;
  if (command === "dev") return words.slice(1).every((word) => DEV_FLAGS.test(word));
  if (command !== "env") return false;
  if (sub === "list") return rest.length === 0;
  if (sub === "get") return rest.length === 1 && NAME.test(rest[0]);
  if (sub === "set") return rest.length === 2 && NAME.test(rest[0]) && !rest[1].startsWith("-");
  return false;
}

// Fails closed. A credential name anywhere in the file (comments included)
// counts as a cloud target, so no dotenv parsing quirk can hide one. Lines are
// split on CR, LF or CRLF like dotenv, and every non-comment line that names
// CONVEX_DEPLOYMENT must plainly select an anonymous or local deployment.
function checkEnvFile(dir, file) {
  let text;
  try {
    text = readFileSync(join(dir, file), "utf8");
  } catch {
    return;
  }
  const credential = CREDENTIALS.find((name) => text.includes(name));
  if (credential) deny(`${credential} appears in ${file}; it can point the CLI at a cloud deployment. Remove it for local work, or ask Eric.`);
  for (const line of text.split(/\r\n|\r|\n/)) {
    if (!line.includes("CONVEX_DEPLOYMENT") || /^\s*#/.test(line)) continue;
    const local = /^\s*(?:export\s+)?CONVEX_DEPLOYMENT\s*[=:]\s*["'`]?(?:anonymous|local):[\w-]+["'`]?\s*(?:#.*)?$/.test(line);
    if (!local) deny(`CONVEX_DEPLOYMENT in ${file} is not a local or anonymous deployment. Use a worktree without a cloud .env.local, or ask Eric.`);
  }
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const command = input?.tool_input?.command;
if (typeof command !== "string" || !PREFIX.test(command)) process.exit(0);

// Only plain words the shell passes through unchanged: no chaining, pipes,
// subshells, redirects, quoting, escapes, expansions or globs.
if (/[;&|`<>'"\\$(){}*?[\]~!#\n]/.test(command)) ask("only plain, unquoted Convex commands are auto-allowed.");

const words = command.replace(PREFIX, "").trim().split(/\s+/).filter(Boolean);
if (words[0] === "deploy") deny("convex deploy is never auto-allowed. Ask Eric.");
if (!allowedShape(words)) ask("only `dev` with local-only flags and `env list|get NAME|set NAME VALUE` are auto-allowed.");

const deployment = process.env.CONVEX_DEPLOYMENT;
if (deployment && !LOCAL.test(deployment)) deny(`CONVEX_DEPLOYMENT in the shell is "${deployment}", not a local or anonymous deployment. Ask Eric.`);
const credential = CREDENTIALS.find((name) => name in process.env);
if (credential) deny(`${credential} is set in the shell; it can point the CLI at a cloud deployment. Unset it for local work, or ask Eric.`);

const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
checkEnvFile(cwd, ".env.local");
checkEnvFile(cwd, ".env");
process.exit(0);
