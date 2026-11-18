// The Stop hook that keeps a Claude Code session from ending while checks
// fail on its changes (standards/verification.md), and the drift check that
// `check-project.mjs` runs on `.claude/settings.json`.

export const STOP_FILE = '.claude/hooks/stop-checks.mjs';
export const STOP_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/stop-checks.mjs"';
export const STOP_SOURCE = 'docs/standards/verification/stop-checks.mjs';

// Returns check-project findings for one project. `settingsText` is the text
// of .claude/settings.json (null when absent); `hookText` and `sourceText` are
// the installed hook and the distributed copy (null when absent).
export function stopCheckFindings({ settingsText, hookText, sourceText }) {
  if (settingsText === null) return [];
  let settings;
  try { settings = JSON.parse(settingsText); }
  catch { return []; } // agentPermissionFindings already reports invalid JSON
  const entries = Array.isArray(settings?.hooks?.Stop) ? settings.hooks.Stop : [];
  const registered = entries.some(entry =>
    Array.isArray(entry?.hooks) && entry.hooks.some(hook => hook?.type === 'command' && hook.command === STOP_COMMAND));
  const findings = [registered
    ? { level: 'pass', message: `.claude/settings.json: ${STOP_FILE} runs as a Stop hook` }
    : { level: 'fail', message: `.claude/settings.json: register ${STOP_COMMAND} as a Stop hook` }];
  if (hookText === null) findings.push({ level: 'fail', message: `${STOP_FILE}: missing; copy it from ${STOP_SOURCE}` });
  else if (sourceText !== null && hookText !== sourceText) findings.push({ level: 'warn', message: `${STOP_FILE}: differs from ${STOP_SOURCE}; copy the current version` });
  return findings;
}
