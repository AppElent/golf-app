#!/usr/bin/env node
// Claude Code Stop hook (standards/verification.md). A session cannot end while
// lint, types or related tests fail on its changes.
//
// - No changes against the default branch, or the same changes that passed
//   last time: exit 0 at once.
// - Otherwise: Biome on the changed files, `typecheck` of each changed
//   workspace package, then Vitest/Jest related tests. A failure exits 2 with a
//   short reason on stderr, which sends Claude back to fix it.
// - The run has a time budget, and a session is blocked at most a few times in
//   a row. Past either limit the session may stop, and the hook reports the
//   failures to the user instead.
//
// Opt out for one session with APPELENT_STOP_CHECKS=off.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_BUDGET_MS = 180_000;
export const DEFAULT_MAX_BLOCKS = 3;
const OUTPUT_LINES = 40;
const LARGE_FILE = 1024 * 1024;
const SERIES_MS = 15 * 60_000;
const REASON_CHARS = 6000;
const CODE = /\.(?:[cm]?[jt]sx?)$/;
const TYPE_INPUT = /(?:^|\/)(?:tsconfig[^/]*\.json|package\.json)$/;
const BASES = ['origin/HEAD', 'origin/main', 'origin/master'];

function git(root, args, options = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: options.encoding ?? 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) return null;
  return result.stdout;
}

// The commit the session's work starts from: where HEAD left the default
// branch. On the default branch itself that is HEAD, so only uncommitted work
// counts. Without a remote, only uncommitted work counts too.
export function baseCommit(root) {
  for (const ref of BASES) {
    const base = git(root, ['merge-base', 'HEAD', ref])?.trim();
    if (base) return base;
  }
  return git(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])?.trim() || null;
}

// Files added or changed since `base`, committed or not, plus untracked files.
// Deleted files are left out: there is nothing left to lint.
export function changedFiles(root, base) {
  const tracked = base ? git(root, ['diff', '--name-only', '--diff-filter=d', '-z', base]) ?? '' : '';
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z']) ?? '';
  const files = new Set([...tracked.split('\0'), ...untracked.split('\0')].filter(Boolean));
  return [...files].filter(file => existsSync(join(root, file))).sort();
}

// Identifies the exact state being checked, so a state that passed once is
// not checked again.
// Committing a checked change keeps the same fingerprint.
export function fingerprint(root, base, files) {
  const hash = createHash('sha256').update(`${base ?? ''}\0`);
  if (base) hash.update(git(root, ['diff', '--name-only', '--diff-filter=D', '-z', base]) ?? '');
  for (const file of files) {
    hash.update(`\0${file}\0`);
    try {
      const stat = statSync(join(root, file));
      // Large files (build output, media) count by size and time, not content.
      hash.update(stat.size > LARGE_FILE ? `${stat.size}:${stat.mtimeMs}` : readFileSync(join(root, file)));
    } catch { /* a directory or unreadable file */ }
  }
  return hash.digest('hex');
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

// The nearest package.json at or above `file`, inside `root`.
function packageOf(root, file) {
  let dir = dirname(join(root, file));
  while (dir.startsWith(root)) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    if (dir === root) break;
    dir = dirname(dir);
  }
  return root;
}

function testRunner(script) {
  if (/\bvitest\b/.test(script ?? '')) return 'vitest';
  if (/\bjest\b/.test(script ?? '')) return 'jest';
  return null;
}

// Turns changed files into the checks to run, in order: lint, types, tests.
// `read(path)` returns parsed JSON or null; it is injectable for tests.
export function planChecks(root, files, read = readJson) {
  const checks = [];
  if (!files.length) return checks;
  if (existsSync(join(root, 'biome.json')) || existsSync(join(root, 'biome.jsonc'))) {
    checks.push({
      name: 'lint',
      cwd: root,
      command: 'pnpm',
      args: ['exec', 'biome', 'check', '--no-errors-on-unmatched', '--files-ignore-unknown=true', ...files],
      fix: 'pnpm exec biome check --write <files>',
    });
  }
  const code = files.filter(file => CODE.test(file));
  const typeInputs = files.filter(file => CODE.test(file) || TYPE_INPUT.test(file));
  const packages = new Map();
  for (const file of typeInputs) {
    const dir = packageOf(root, file);
    if (!packages.has(dir)) packages.set(dir, []);
    if (CODE.test(file)) packages.get(dir).push(join(root, file));
  }
  const rootPkg = read(join(root, 'package.json')) ?? {};
  const rootTypecheck = rootPkg.scripts?.typecheck ?? '';
  const ordered = [...packages.keys()].sort((a, b) => (a === root ? -1 : b === root ? 1 : a.localeCompare(b)));
  for (const dir of ordered) {
    const pkg = read(join(dir, 'package.json')) ?? {};
    if (!pkg.scripts?.typecheck) continue;
    // A root typecheck that already filters to this package covers it.
    if (dir !== root && pkg.name && packages.has(root) && rootTypecheck.includes(pkg.name)) continue;
    const label = relative(root, dir) || '.';
    checks.push({ name: `types (${label})`, cwd: dir, command: 'pnpm', args: ['run', 'typecheck'] });
  }
  if (!code.length) return checks;
  // Root Vitest follows imports across the workspace, so it gets every changed
  // code file; a package's own runner gets that package's files.
  const testDirs = new Set([root, ...[...packages.keys()].filter(dir => packages.get(dir).length)]);
  for (const dir of [...testDirs].sort((a, b) => (a === root ? -1 : b === root ? 1 : a.localeCompare(b)))) {
    const pkg = read(join(dir, 'package.json')) ?? {};
    const runner = testRunner(pkg.scripts?.test);
    const targets = dir === root ? code.map(file => join(root, file)) : packages.get(dir);
    if (!runner || !targets.length) continue;
    const label = relative(root, dir) || '.';
    checks.push(runner === 'vitest'
      ? { name: `tests (${label})`, cwd: dir, command: 'pnpm', args: ['exec', 'vitest', 'related', '--run', '--passWithNoTests', ...targets] }
      : { name: `tests (${label})`, cwd: dir, command: 'pnpm', args: ['exec', 'jest', '--findRelatedTests', '--passWithNoTests', ...targets] });
  }
  return checks;
}

export function runCommand(check, timeoutMs) {
  const result = spawnSync(check.command, check.args, {
    cwd: check.cwd,
    encoding: 'utf8',
    timeout: Math.max(1, timeoutMs),
    killSignal: 'SIGKILL',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error?.code === 'ETIMEDOUT' || (result.signal && result.status === null)) return { status: 'timeout', output };
  if (result.error) return { status: 'error', output: result.error.message };
  return { status: result.status === 0 ? 'pass' : 'fail', output };
}

// Package-manager echo and bundler progress, which bury the actual error.
const NOISE = /^(?:\$ |> |\[ELIFECYCLE\]|ELIFECYCLE|(?:CLI|ESM|CJS|DTS) )/;

function tail(text, lines = OUTPUT_LINES) {
  const all = text.replace(/\x1b\[[0-9;]*m/g, '').trimEnd().split('\n').filter(line => !NOISE.test(line.trim()));
  return (all.length > lines ? ['…', ...all.slice(-lines)] : all).join('\n');
}

function display(check) {
  const args = check.args.map(arg => (arg.startsWith('/') ? relative(check.cwd, arg) || '.' : arg));
  const shown = args.length > 12 ? [...args.slice(0, 12), '…'] : args;
  return `${check.command} ${shown.join(' ')}`;
}

function statePath(root) {
  const id = createHash('sha256').update(root).digest('hex').slice(0, 16);
  return join(tmpdir(), 'appelent-stop-checks', `${id}.json`);
}

// Trusts only a state file this user owns, so nobody else can plant a pass.
function loadState(path) {
  const empty = { passed: null, sessions: {} };
  try { if (process.getuid && statSync(path).uid !== process.getuid()) return empty; } catch { return empty; }
  return readJson(path) ?? empty;
}

function saveState(path, state) {
  try {
    const sessions = Object.entries(state.sessions ?? {}).sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0)).slice(0, 20);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify({ ...state, sessions: Object.fromEntries(sessions) }), { mode: 0o600 });
  } catch { /* state is a cache; losing it only costs a re-run */ }
}

// Result: { exitCode, stderr?, stdout? }. `deps` is injectable for tests.
export function stopChecks(input, deps = {}) {
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  const run = deps.run ?? runCommand;
  const read = deps.read ?? readJson;
  if (/^(off|0|false)$/i.test(env.APPELENT_STOP_CHECKS ?? '')) return { exitCode: 0 };
  const start = now();
  const budget = Number(env.APPELENT_STOP_CHECKS_BUDGET_MS) || DEFAULT_BUDGET_MS;
  const maxBlocks = Number(env.APPELENT_STOP_CHECKS_MAX_BLOCKS) || DEFAULT_MAX_BLOCKS;
  const cwd = env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const top = git(cwd, ['rev-parse', '--show-toplevel'])?.trim();
  if (!top) return { exitCode: 0 };
  const root = resolve(top);
  const base = baseCommit(root);
  const files = changedFiles(root, base);
  if (!files.length) return { exitCode: 0 };
  const note = message => ({ exitCode: 0, stdout: JSON.stringify({ systemMessage: `Stop checks: ${message}` }) });
  if (!existsSync(join(root, 'node_modules'))) return note('skipped, dependencies are not installed. Run `pnpm install`, then `pnpm verify`.');

  const path = deps.statePath ?? statePath(root);
  const state = loadState(path);
  const print = fingerprint(root, base, files);
  if (state.passed === print) return { exitCode: 0 };
  const session = input.session_id || 'unknown';
  // A stop right after a user turn starts a new series of attempts. When the
  // harness leaves out stop_hook_active, a recent block continues the series.
  const last = state.sessions?.[session];
  const continuing = input.stop_hook_active ?? (last && now() - (last.at ?? 0) < SERIES_MS);
  const blocks = continuing ? last?.blocks ?? 0 : 0;

  const failures = [];
  let stopped = null;
  for (const check of planChecks(root, files, read)) {
    const left = budget - (now() - start);
    if (left <= 0) { stopped = `the ${budget / 1000}s budget ran out before ${check.name}`; break; }
    const result = run(check, left);
    if (result.status === 'timeout') { stopped = `${check.name} ran past the ${budget / 1000}s budget`; break; }
    if (result.status === 'error') { failures.push({ check, output: `Could not run: ${result.output}`, infra: true }); continue; }
    if (result.status === 'fail') failures.push({ check, output: result.output });
  }
  const real = failures.filter(failure => !failure.infra);
  const infra = failures.filter(failure => failure.infra).map(failure => `${failure.check.name} could not run`);

  if (!real.length) {
    if (!stopped && !infra.length) {
      state.passed = print;
      delete state.sessions?.[session];
      saveState(path, state);
      return { exitCode: 0 };
    }
    saveState(path, state);
    return note(`${[...infra, stopped].filter(Boolean).join('; ')}. Run \`pnpm verify\` before reporting done.`);
  }

  const summary = real.map(({ check, output }) =>
    `## ${check.name}: \`${display(check)}\`${check.fix ? ` (fix: \`${check.fix}\`)` : ''}\n${tail(output)}`).join('\n\n');
  if (blocks >= maxBlocks) {
    state.sessions = { ...state.sessions, [session]: { blocks: 0, at: now() } };
    saveState(path, state);
    const names = real.map(({ check }) => check.name).join(', ');
    return {
      exitCode: 0,
      stdout: JSON.stringify({ systemMessage: `Stop checks still fail after ${maxBlocks} attempts (${names}); the session was allowed to end. Do not treat this work as done. Run \`pnpm verify\`.` }),
      stderr: summary.slice(0, REASON_CHARS),
    };
  }
  state.sessions = { ...state.sessions, [session]: { blocks: blocks + 1, at: now() } };
  saveState(path, state);
  const header = `Stop checks failed on your changes (attempt ${blocks + 1} of ${maxBlocks}). Fix them before you finish; do not weaken or skip a check.${stopped ? ` Not run: ${stopped}.` : ''}`;
  const reason = `${header}\n\n${summary}`;
  return { exitCode: 2, stderr: reason.length > REASON_CHARS ? `${reason.slice(0, REASON_CHARS)}\n…` : reason };
}

function readStdin() {
  try { return JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try { result = stopChecks(readStdin()); }
  catch (error) { result = { exitCode: 0, stdout: JSON.stringify({ systemMessage: `Stop checks: hook error, not run (${error.message}). Run \`pnpm verify\`.` }) }; }
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exitCode = result.exitCode;
}

