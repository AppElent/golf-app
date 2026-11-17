#!/usr/bin/env node
// PreToolUse guard for `pnpm env:*` (developer-home standards/environments.md).
// The allow rules in .claude/settings.json cover `env:check`, `env:plan`,
// `env:generate` and `env:apply <environment>`. This hook keeps them to plain,
// non-destructive shapes in this repository: anything else (--prune, --yes,
// --path, which would run another folder's manifest, ...) goes back to a
// normal permission prompt. `env:exec` is never covered by an allow rule.
import { readFileSync } from "node:fs";

const ENV_SCRIPT = /^\s*pnpm\s+(?:run\s+)?env:(apply|plan|check|generate)(?=\s|$)/;
const ENVIRONMENTS = new Set(["local", "dev", "preview", "staging", "production"]);
const KINDS = new Set(["infisical", "file", "convex", "worker", "github", "eas"]);

function ask(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: `env-guard: ${reason}`,
      },
    }),
  );
  process.exit(0);
}

// apply and plan need an environment; check takes an optional one; generate
// takes only --dry-run/--json.
function allowedShape(script, words) {
  let rest = words;
  if (script === "generate") return words.every((word) => word === "--dry-run" || word === "--json");
  if (ENVIRONMENTS.has(words[0])) rest = words.slice(1);
  else if (script !== "check") return false;
  for (let i = 0; i < rest.length; i += 1) {
    const word = rest[i];
    if (word === "--json" || (word === "--dry-run" && script === "apply")) continue;
    if (word === "--ci" && script === "check") continue;
    if (word === "--only" && KINDS.has(rest[i + 1])) { i += 1; continue; }
    if (word === "--pr" && /^[1-9][0-9]*$/.test(rest[i + 1] ?? "")) { i += 1; continue; }
    return false; // --prune, --yes, --path, apply --ci, a second positional, ...
  }
  return true;
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  ask("could not read the tool input."); // fail closed
}
const command = input?.tool_input?.command;
if (typeof command !== "string") process.exit(0);
const match = ENV_SCRIPT.exec(command);
// The allow rules also match subcommands of a compound command (`a && b`) or a
// wrapper (`timeout 5 ...`), so any other mention of these scripts needs a prompt.
if (!match) {
  if (/env:(?:apply|plan|check|generate)/.test(command)) ask("env commands are auto-allowed only as a standalone command.");
  process.exit(0);
}
if (/[;&|`<>'"\\$(){}*?[\]~!#\n]/.test(command)) ask("only plain, unquoted env commands are auto-allowed.");
const words = command.slice(match[0].length).trim().split(/\s+/).filter(Boolean);
if (!allowedShape(match[1], words)) ask(`this env:${match[1]} shape is not auto-allowed; --prune, --yes, --path and apply --ci need a prompt.`);
process.exit(0);
