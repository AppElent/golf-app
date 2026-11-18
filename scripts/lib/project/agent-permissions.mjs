// Baseline Claude Code deny rules (standards/agent-permissions.md) and the
// drift check that `check-project.mjs` runs on `.claude/settings.json`.
// Every rule here passes the reversibility test: if an agent got it wrong once,
// it could not be taken back. Projects add their own rules next to these; they
// never drop one.

const branches = ['main', 'master'];

export const BASELINE_DENY = Object.freeze([
  // Secrets: dotenv files, Wrangler local secrets, signing keys, CLI sessions.
  'Read(**/.env)',
  'Read(**/.env.*)',
  'Read(**/.dev.vars)',
  'Read(**/.dev.vars.*)',
  'Read(**/*.pem)',
  'Read(**/*.key)',
  'Read(**/*.p8)',
  'Read(**/*.p12)',
  'Read(**/*.jks)',
  'Read(**/*.keystore)',
  'Read(**/credentials.json)',
  'Read(~/.ssh/**)',
  'Read(~/.aws/**)',
  'Read(~/.gnupg/**)',
  'Read(~/.config/gh/**)',
  'Read(~/.convex/**)',
  'Read(~/.expo/**)',
  'Read(~/.netrc)',
  'Read(~/.npmrc)',
  // Deleting a home or system folder.
  'Bash(rm -rf /)',
  'Bash(rm -rf ~)',
  'Bash(rm -rf ~/)',
  'Bash(rm -rf $HOME)',
  'Bash(rm -rf ..)',
  // Rewriting or deleting the default branch.
  ...branches.flatMap(branch => [
    `Bash(git push --force * ${branch})`,
    `Bash(git push -f * ${branch})`,
    `Bash(git push --force-with-lease * ${branch})`,
    `Bash(git push * +${branch})`,
    `Bash(git push * :${branch})`,
    `Bash(git push * --delete ${branch})`,
  ]),
  // Production Convex.
  'Bash(convex deploy*)',
  'Bash(npx convex deploy*)',
  'Bash(pnpm exec convex deploy*)',
  'Bash(pnpm convex deploy*)',
  'Bash(npx convex * --prod*)',
  'Bash(pnpm exec convex * --prod*)',
  // Store submissions, production store builds, production OTA.
  'Bash(eas submit*)',
  'Bash(npx eas submit*)',
  'Bash(npx eas-cli submit*)',
  'Bash(pnpm exec eas submit*)',
  'Bash(eas build * --auto-submit*)',
  'Bash(eas build * --profile production*)',
  'Bash(eas update * --channel production*)',
  'Bash(eas update * --branch production*)',
  // Production Worker.
  'Bash(wrangler deploy)',
  'Bash(npx wrangler deploy)',
  'Bash(pnpm exec wrangler deploy)',
  'Bash(wrangler deploy --env production*)',
  // Package scripts that deploy or ship.
  'Bash(pnpm deploy)',
  'Bash(pnpm run deploy)',
  'Bash(pnpm deploy:prod*)',
  'Bash(pnpm run deploy:prod*)',
  'Bash(pnpm ship:production*)',
  'Bash(pnpm run ship:production*)',
  'Bash(pnpm mobile:update:production*)',
  'Bash(pnpm run mobile:update:production*)',
]);

export const GUARD_FILE = '.claude/hooks/irreversible-guard.mjs';
export const GUARD_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/irreversible-guard.mjs"';
export const GUARD_SOURCE = 'docs/standards/agent-permissions/irreversible-guard.mjs';

// Returns check-project findings for one project. `settingsText` is the text
// of .claude/settings.json (null when absent); `guardText` and `sourceText` are
// the installed hook and the distributed copy (null when absent).
export function agentPermissionFindings({ settingsText, guardText, sourceText }) {
  if (settingsText === null) return [{ level: 'info', message: 'No .claude/settings.json; agent deny baseline not checked' }];
  let settings;
  try { settings = JSON.parse(settingsText); }
  catch { return [{ level: 'fail', message: '.claude/settings.json: not valid JSON' }]; }
  const findings = [];
  const deny = Array.isArray(settings?.permissions?.deny) ? settings.permissions.deny : [];
  const missing = BASELINE_DENY.filter(rule => !deny.includes(rule));
  findings.push(missing.length
    ? { level: 'fail', message: `.claude/settings.json: permissions.deny lacks ${missing.length} baseline rule(s): ${missing.join(', ')}` }
    : { level: 'pass', message: '.claude/settings.json: permissions.deny has the agent baseline' });
  const allow = Array.isArray(settings?.permissions?.allow) ? settings.permissions.allow : [];
  const shadowed = allow.filter(rule => BASELINE_DENY.includes(rule));
  if (shadowed.length) findings.push({ level: 'warn', message: `.claude/settings.json: allow repeats denied rule(s): ${shadowed.join(', ')}` });
  const entries = Array.isArray(settings?.hooks?.PreToolUse) ? settings.hooks.PreToolUse : [];
  const registered = entries.some(entry =>
    entry?.matcher === 'Bash' && Array.isArray(entry.hooks) && entry.hooks.some(hook => hook?.type === 'command' && hook.command === GUARD_COMMAND));
  findings.push(registered
    ? { level: 'pass', message: `.claude/settings.json: ${GUARD_FILE} runs as a Bash PreToolUse hook` }
    : { level: 'fail', message: `.claude/settings.json: register ${GUARD_COMMAND} as a Bash PreToolUse hook` });
  if (guardText === null) findings.push({ level: 'fail', message: `${GUARD_FILE}: missing; copy it from ${GUARD_SOURCE}` });
  else if (sourceText !== null && guardText !== sourceText) findings.push({ level: 'warn', message: `${GUARD_FILE}: differs from ${GUARD_SOURCE}; copy the current version` });
  return findings;
}
