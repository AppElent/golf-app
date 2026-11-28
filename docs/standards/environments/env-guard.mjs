#!/usr/bin/env node
// PreToolUse guard for `pnpm env:*` (developer-home standards/environments.md).
// The allow rules in .claude/settings.json cover `env:check`, `env:plan`,
// `env:generate` and `env:apply <environment>`. This hook keeps them to plain,
// non-destructive shapes in this repository: anything else (--prune, --yes,
// --path, which would run another folder's manifest, ...) goes back to a
// normal permission prompt. `env:exec` is never covered by an allow rule.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENV_SCRIPT = /^\s*pnpm\s+(?:run\s+)?env:(apply|plan|check|generate)(?=\s|$)/;
// A package manager running an env script anywhere in a command: after the
// start, a separator, a wrapper or a subshell. Quotes in between (`pnpm
// "env:apply"`) still count.
const RUNS_ENV_SCRIPT = /\b(?:pnpm|npm|yarn|bun|corepack|npx)\b[^;&|\n]*?\benv:(?:apply|plan|check|generate)\b/;
const ENVIRONMENTS = new Set(["local", "dev", "preview", "staging", "production"]);
const KINDS = new Set(["infisical", "file", "convex", "worker", "github", "eas"]);
// The read-only `env:check` may keep the wrappers agents put around it: one
// leading `cd <plain path>;` (or `&&`), then a trailing `2>&1` and one
// `| tail`/`| head` with at most a line count. Nothing else is peeled off.
const CD_PREFIX = /^\s*cd\s+([A-Za-z0-9_./@+][A-Za-z0-9_./@+-]*)\s*(?:;|&&)\s*/;
const READ_SUFFIX = /\s+(?:2>&1\s*)?(?:\|\s*(?:tail|head)(?:\s+(?:-n\s*[1-9][0-9]*|-[1-9][0-9]*))?\s*)?$/;

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

// Returns the `env:check` command inside the allowed wrappers, or the command
// unchanged when it has no wrappers or the inner command is not env:check.
function unwrapCheck(command) {
  let inner = command;
  const cd = CD_PREFIX.exec(inner);
  if (cd) inner = inner.slice(cd[0].length);
  const suffix = READ_SUFFIX.exec(inner);
  if (suffix && suffix[0].trim()) inner = inner.slice(0, suffix.index);
  if (inner === command) return command;
  return ENV_SCRIPT.exec(inner)?.[1] === "check" ? inner : command;
}

// Returns the reason to ask for a prompt, or null to leave the decision to the
// allow rules.
export function evaluate(rawCommand) {
  if (typeof rawCommand !== "string") return null;
  const command = unwrapCheck(rawCommand);
  const match = ENV_SCRIPT.exec(command);
  // The allow rules also match subcommands of a compound command (`a && b`) or a
  // wrapper (`timeout 5 ...`), so any other mention of these scripts needs a prompt.
  if (!match) {
    // Only a run of the scripts counts: a package manager word followed by an
    // env script. A read that merely names one (`grep "env:generate"
    // package.json`, `cat env.manifest.ts`) is left to the other checks
    // (28 Nov 2026: such reads stopped T3 threads on a prompt).
    if (RUNS_ENV_SCRIPT.test(command)) return "env commands are auto-allowed only as a standalone command.";
    return null;
  }
  if (/[;&|`<>'"\\$(){}*?[\]~!#\n]/.test(command)) return "only plain, unquoted env commands are auto-allowed.";
  const words = command.slice(match[0].length).trim().split(/\s+/).filter(Boolean);
  if (!allowedShape(match[1], words)) return `this env:${match[1]} shape is not auto-allowed; --prune, --yes, --path and apply --ci need a prompt.`;
  return null;
}

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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    ask("could not read the tool input."); // fail closed
  }
  const reason = evaluate(input?.tool_input?.command);
  if (reason) ask(reason);
  process.exit(0);
}
