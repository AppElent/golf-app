#!/usr/bin/env node
// PreToolUse guard for local Convex commands (developer-home standards/convex.md).
// The allow rules in .claude/settings.json only cover commands prefixed with
// CONVEX_AGENT_MODE=anonymous. This hook denies such a command when it could
// reach a cloud deployment, so the allow rules stay local-only.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PREFIX = /^\s*CONVEX_AGENT_MODE=anonymous\s+(?:npx|pnpm\s+exec)\s+convex\b/;
const FORBIDDEN = /(?:^|\s)(?:deploy|--prod|--deployment|--deployment-name|--url|--admin-key|--cloud|--preview-name|--env-file)(?=[=\s]|$)/;
const LOCAL = /^(?:anonymous|local):/;

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `convex-local-guard: ${reason}`,
      },
    }),
  );
  process.exit(0);
}

function deploymentFromEnvFile(dir, file) {
  try {
    const text = readFileSync(join(dir, file), "utf8");
    const line = text.split(/\r?\n/).find((l) => /^\s*CONVEX_DEPLOYMENT\s*=/.test(l));
    if (!line) return undefined;
    return line.split("=").slice(1).join("=").split("#")[0].trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
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

// Only one plain command: no chaining, pipes, subshells or redirects.
if (/[;&|`<>]|\$\(|\n/.test(command)) deny("chained or redirected Convex commands are not auto-allowed; run the command on its own.");

const rest = command.replace(PREFIX, "");
if (FORBIDDEN.test(rest)) deny("deploy, --prod and deployment-selecting flags are never auto-allowed. Ask Eric.");

const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
for (const [source, value] of [
  ["the shell", process.env.CONVEX_DEPLOYMENT],
  [".env.local", deploymentFromEnvFile(cwd, ".env.local")],
  [".env", deploymentFromEnvFile(cwd, ".env")],
]) {
  if (value && !LOCAL.test(value)) {
    deny(`CONVEX_DEPLOYMENT in ${source} is "${value}", not a local or anonymous deployment. Use a worktree without a cloud .env.local, or ask Eric.`);
  }
}
process.exit(0);
