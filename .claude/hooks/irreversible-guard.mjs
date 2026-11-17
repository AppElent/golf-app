#!/usr/bin/env node
// PreToolUse guard for irreversible commands (developer-home standards/agent-permissions.md).
// The `permissions.deny` baseline in .claude/settings.json matches commands as
// written, so `npx eas-cli submit`, `sh -c '…'` or `git -C x push -f` slip past
// it. This hook reads every command in a Bash call, also inside `sh -c`,
// `eval`, `$(…)`, backticks and wrappers such as `timeout`, `env` or `npx`,
// and denies the irreversible ones:
// - recursive `rm` of the project root, an ancestor, or anything outside the
//   project, its additionalDirectories and the temp folders
// - force push or branch delete on `main`/`master`
// - `convex deploy`, any Convex command with `--prod` or a deploy key
// - `eas submit`, `--auto-submit`, production `eas build` (the default
//   profile), and `eas update`/`channel`/`branch`/`env` writes on production
// - `wrangler deploy`/`secret`/`versions deploy`/`rollback` without a
//   non-production `--env`
// - package scripts that deploy or ship (`deploy`, `deploy:*`, `ship:*`
//   except `:dev`, and any script ending in `:prod`/`:production`)
// Everything else exits silently and keeps the normal permission flow. An
// unreadable hook input asks. Approved irreversible steps run in their CI
// workflow or by Eric himself, never through this agent.
import { execFileSync } from "node:child_process";
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

class Decision {
  constructor(kind, reason) {
    this.kind = kind;
    this.reason = reason;
  }
}
const deny = (reason) => {
  throw new Decision("deny", `${reason} It is on the agent deny list (standards/agent-permissions.md): it runs in CI or by Eric, not by an agent.`);
};
const ask = (reason) => {
  throw new Decision("ask", reason);
};

// ---------------------------------------------------------------- parsing

// Splits a shell string into simple commands (arrays of words). Separators:
// ; & && | || newline ( ) and the bodies of $(…) / `…` (also inside double
// quotes), which become commands of their own. Quotes are removed; a word that
// held an unquoted expansion keeps its `$`/`~` so path checks can see it.
export function parse(source) {
  const commands = [];
  let words = [];
  let word = "";
  let inWord = false;
  const heredocs = [];
  // Here-strings (`bash <<< 'eas submit'`): a shell recipient runs the word.
  const hereStrings = [];
  let hereString = false;
  // A redirect target is not an argument, but its $(…) and backticks still run.
  let redirectTarget = false;
  const endWord = () => {
    if (inWord && redirectTarget) redirectTarget = false;
    else if (inWord && hereString) hereStrings.push(word);
    else if (inWord) words.push(word);
    if (inWord) hereString = false;
    word = "";
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    hereString = false;
    redirectTarget = false;
    if (hereStrings.length) {
      const recipient = words.length ? unwrap(words).words?.[0] : undefined;
      // Checked as `<recipient> -c <body>`, so wrappers such as `env -C` apply.
      if (recipient !== undefined && SHELLS.has(programName(recipient))) for (const body of hereStrings) commands.push([...words, "-c", body]);
      hereStrings.length = 0;
    }
    if (words.length) commands.push(words);
    words = [];
  };
  // Returns the index just past the matching `)` for a `$(` at i.
  const closeParen = (i) => {
    let depth = 1;
    let quote = null;
    for (let j = i; j < source.length; j++) {
      const c = source[j];
      if (quote) {
        if (c === "\\" && quote === '"') j++;
        else if (c === quote) quote = null;
      } else if (c === "'" || c === '"') quote = c;
      else if (c === "\\") j++;
      else if (c === "(") depth++;
      else if (c === ")" && --depth === 0) return j;
    }
    return source.length;
  };
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "\\") {
      if (source[i + 1] === "\n") { i += 2; continue; }
      word += source[i + 1] ?? "";
      inWord = true;
      i += 2;
    } else if (c === "'") {
      const end = source.indexOf("'", i + 1);
      const stop = end === -1 ? source.length : end;
      word += source.slice(i + 1, stop);
      inWord = true;
      i = stop + 1;
    } else if (c === '"') {
      inWord = true;
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\" && i + 1 < source.length) { word += source[i + 1]; i += 2; continue; }
        if (source[i] === "$" && source[i + 1] === "(") {
          const end = closeParen(i + 2);
          commands.push(...parse(source.slice(i + 2, end)));
          word += "$";
          i = end + 1;
          continue;
        }
        if (source[i] === "`") {
          const end = source.indexOf("`", i + 1);
          const stop = end === -1 ? source.length : end;
          commands.push(...parse(source.slice(i + 1, stop)));
          word += "$";
          i = stop + 1;
          continue;
        }
        word += source[i];
        i++;
      }
      i++;
    } else if (c === "$" && source[i + 1] === "'") {
      // ANSI-C quoting: `$'eas'` is the word eas.
      let j = i + 2;
      let text = "";
      while (j < source.length && source[j] !== "'") {
        if (source[j] === "\\" && j + 1 < source.length) {
          const rest = source.slice(j + 1);
          const hex = /^x([0-9a-fA-F]{1,2})/.exec(rest);
          const uni = /^[uU]([0-9a-fA-F]{1,8})/.exec(rest);
          const oct = /^([0-7]{1,3})/.exec(rest);
          const simple = { n: "\n", t: "\t", r: "\r", a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", v: "\v" };
          if (hex) { text += String.fromCharCode(parseInt(hex[1], 16)); j += 1 + hex[0].length; }
          else if (uni) { text += String.fromCodePoint(Math.min(parseInt(uni[1], 16), 0x10ffff)); j += 1 + uni[0].length; }
          else if (oct) { text += String.fromCharCode(parseInt(oct[1], 8)); j += 1 + oct[0].length; }
          else if (source[j + 1] in simple) { text += simple[source[j + 1]]; j += 2; }
          else { text += source[j + 1]; j += 2; }
        } else text += source[j++];
      }
      word += text;
      inWord = true;
      i = j + 1;
    } else if (c === "$" && source[i + 1] === "(") {
      const end = closeParen(i + 2);
      commands.push(...parse(source.slice(i + 2, end)));
      word += "$";
      inWord = true;
      i = end + 1;
    } else if (c === "`") {
      const end = source.indexOf("`", i + 1);
      const stop = end === -1 ? source.length : end;
      commands.push(...parse(source.slice(i + 1, stop)));
      word += "$";
      inWord = true;
      i = stop + 1;
    } else if (";&|()\n".includes(c) && !(c === "\n" && heredocs.length)) {
      endCommand();
      i++;
    } else if (c === "<" && source[i + 1] === "<" && source[i + 2] === "<") {
      endWord();
      hereString = true;
      i += 3;
    } else if (c === "<" && source[i + 1] === "<") {
      // Heredoc: its body is data (a commit message, a PR body), except when
      // a shell reads it as a script (`sh <<EOF`).
      endWord();
      i += 2;
      if (source[i] === "-") i++;
      while (source[i] === " " || source[i] === "\t") i++;
      let j = i;
      while (j < source.length && !" \t\n;&|()<>".includes(source[j])) j++;
      const raw = source.slice(i, j);
      heredocs.push({ delimiter: raw.replace(/["'\\]/g, ""), quoted: /["'\\]/.test(raw), words });
      i = j;
    } else if (c === "\n" && heredocs.length) {
      // Skip each pending heredoc body up to its delimiter line.
      let at = i + 1;
      for (const doc of heredocs) {
        const lines = [];
        while (at <= source.length) {
          const end = source.indexOf("\n", at);
          const line = source.slice(at, end === -1 ? source.length : end);
          at = end === -1 ? source.length + 1 : end + 1;
          if (line.replace(/^\t+/, "") === doc.delimiter) break;
          lines.push(line);
        }
        const body = lines.join("\n");
        // The recipient may sit behind a wrapper (`env bash <<EOF`).
        const recipient = doc.words.length ? unwrap(doc.words).words?.[0] : undefined;
        if (recipient !== undefined && SHELLS.has(programName(recipient))) commands.push([...doc.words, "-c", body]);
        // An unquoted body still runs its $(…) and backticks.
        else if (!doc.quoted) commands.push(...parse(`"${body.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`));
      }
      heredocs.length = 0;
      endCommand();
      i = at;
    } else if (c === "<" || c === ">") {
      // A redirect and its target (and a leading fd number) are not arguments.
      if (inWord && /^\d+$/.test(word)) { word = ""; inWord = false; }
      endWord();
      i++;
      while (source[i] === ">" || source[i] === "&") i++;
      while (source[i] === " " || source[i] === "\t") i++;
      redirectTarget = true;
    } else if (c === " " || c === "\t") {
      endWord();
      i++;
    } else if (c === "#" && !inWord) {
      while (i < source.length && source[i] !== "\n") i++;
    } else {
      word += c;
      inWord = true;
      i++;
    }
  }
  endCommand();
  return commands;
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
// `/usr/bin/rm` -> rm, `eas-cli@latest` -> eas-cli.
const programName = (word) => basename(word).replace(/(.)@[^/]*$/, "$1");
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
// Words that start a compound or negated command; the command follows them.
const KEYWORDS = new Set(["if", "then", "elif", "else", "while", "until", "do", "!", "{", "}", "time"]);
const WRAPPER_VALUE_FLAGS = {
  sudo: ["-u", "-g", "-C", "-D", "-h", "-p", "-r", "-t", "-U", "--user", "--group"],
  doas: ["-u", "-C"],
  nice: ["-n", "--adjustment"],
  nohup: [],
  command: [],
  exec: ["-a"],
  caffeinate: ["-t", "-w"],
};
const PACKAGE_MANAGERS = new Set(["pnpm", "npm", "yarn", "bun"]);
const PACKAGE_VALUE_FLAGS = ["--filter", "-F", "-C", "--dir", "--prefix", "--workspace", "--cwd", "--reporter", "--loglevel"];
// Variables named by `export NAME=value` earlier in the same Bash call.
let exported = {};

// Drops leading flags; a flag in `valueFlags` also drops its value.
function skipFlags(rest, valueFlags) {
  while (rest.length && rest[0].startsWith("-") && rest[0] !== "--") {
    const flag = rest.shift();
    if (valueFlags.includes(flag)) rest.shift();
  }
  if (rest[0] === "--") rest.shift();
}

// Index of the subcommand after a package manager's global flags.
function packageCommandIndex(words) {
  let j = 1;
  while (j < words.length && words[j].startsWith("-")) {
    if (PACKAGE_VALUE_FLAGS.includes(words[j]) && !(programName(words[0]) === "pnpm" && words[j] === "-w")) j++;
    j++;
  }
  return j;
}

// Strips assignments and wrappers. Returns { env, words } for the real command,
// or a list of nested commands for `sh -c` / `eval`.
function unwrap(words) {
  const env = {};
  // Directories a wrapper switches to before running the command
  // (`env -C dir`, `sudo -D dir`, `pnpm -C dir exec`).
  const chdir = [];
  let rest = [...words];
  for (;;) {
    while (rest.length && ASSIGNMENT.test(rest[0])) {
      const [name, ...value] = rest.shift().split("=");
      env[name] = value.join("=");
    }
    if (!rest.length) return { env, words: rest, chdir };
    const program = programName(rest[0]);
    if (KEYWORDS.has(rest[0])) {
      rest.shift();
    } else if (rest[0] === "function") {
      // `function name { body; }`: the body's first command follows the name.
      rest.splice(0, 2);
    } else if (rest[0] === "export" || rest[0] === "declare" || rest[0] === "local" || rest[0] === "readonly") {
      // `export NAME=value` keeps NAME for the rest of the call.
      rest.shift();
      for (const token of rest) {
        if (ASSIGNMENT.test(token)) {
          const [name, ...value] = token.split("=");
          exported[name] = value.join("=");
        }
      }
      return { env, words: [], chdir };
    } else if (WRAPPER_VALUE_FLAGS[program]) {
      rest.shift();
      const dirIndex = rest.findIndex((word, index) => index < rest.length - 1 && (word === "-D" || word === "--chdir"));
      if (program === "sudo" && dirIndex !== -1 && rest.slice(0, dirIndex).every((word) => word.startsWith("-"))) chdir.push(rest[dirIndex + 1]);
      skipFlags(rest, WRAPPER_VALUE_FLAGS[program]);
    } else if (program === "env") {
      rest.shift();
      while (rest.length && (rest[0].startsWith("-") || ASSIGNMENT.test(rest[0]))) {
        const token = rest.shift();
        if (token === "-S" || token === "--split-string") return { env, nested: parse(rest.join(" ")), subshell: true, chdir };
        if (token === "-C" || token === "--chdir") chdir.push(rest.shift());
        else if (token.startsWith("--chdir=")) chdir.push(token.slice("--chdir=".length));
        else if (token === "-u" || token === "--unset") rest.shift();
        else if (ASSIGNMENT.test(token)) {
          const [name, ...value] = token.split("=");
          env[name] = value.join("=");
        }
      }
    } else if (program === "timeout") {
      rest.shift();
      skipFlags(rest, ["-s", "--signal", "-k", "--kill-after"]);
      rest.shift(); // duration
    } else if (program === "xargs") {
      rest.shift();
      while (rest.length && rest[0].startsWith("-")) {
        const flag = rest.shift();
        if (/^-[IdEnLPs]$/.test(flag)) rest.shift();
      }
    } else if (program === "npx" || program === "bunx") {
      rest.shift();
      const call = shellCall(rest);
      if (call !== undefined) return { env, nested: parse(call), subshell: true, chdir };
      while (rest.length && rest[0].startsWith("-")) {
        const flag = rest.shift();
        if (flag === "-p" || flag === "--package") rest.shift();
      }
    } else if (PACKAGE_MANAGERS.has(program) && ["exec", "dlx", "x"].includes(rest[packageCommandIndex(rest)])) {
      const globals = rest.slice(1, packageCommandIndex(rest));
      for (let j = 0; j < globals.length; j++) {
        if (["-C", "--dir", "--prefix", "--cwd"].includes(globals[j])) chdir.push(globals[j + 1]);
      }
      rest.splice(0, packageCommandIndex(rest) + 1);
      const call = shellCall(rest);
      if (call !== undefined) return { env, nested: parse(call), subshell: true, chdir };
      skipFlags(rest, PACKAGE_VALUE_FLAGS);
    } else if (rest[0] === "--") {
      rest.shift();
    } else if (SHELLS.has(program)) {
      const flagIndex = rest.findIndex((word, index) => index > 0 && /^-[a-z]*c[a-z]*$/.test(word));
      if (flagIndex === -1) return { env, words: rest, chdir };
      const script = rest[flagIndex + 1];
      return { env, nested: script === undefined ? [] : parse(script), subshell: true, chdir };
    } else if (program === "eval") {
      return { env, nested: parse(rest.slice(1).join(" ")), chdir };
    } else {
      return { env, words: rest, chdir };
    }
  }
}

// `npm exec -c 'eas submit'`, `npx --call …`, `pnpm exec -c eas submit` run
// their argument through a shell. Returns that script, or undefined.
function shellCall(words) {
  const at = words.findIndex((word) => word === "-c" || word === "--call" || word === "--shell-mode" || word.startsWith("--call="));
  if (at === -1) return undefined;
  const flag = words[at];
  const tail = words.slice(at + 1).filter((word) => !/^-/.test(word));
  return flag.startsWith("--call=") ? flag.slice(7) : tail.join(" ");
}

// ----------------------------------------------------------------- checks

const PROTECTED_BRANCHES = new Set(["main", "master"]);
const PRODUCTION = /^(prod|production)$/;

function branchName(ref) {
  return ref.replace(/^\+/, "").replace(/^refs\/heads\//, "");
}

function currentBranch(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// True when push destinations may come from config (`remote.<name>.push`)
// rather than the current branch name.
function pushMapped(dir) {
  try {
    return execFileSync("git", ["-C", dir, "config", "--get-regexp", "^remote\\..*\\.push$"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() !== "";
  } catch {
    return false; // exit 1: no such key
  }
}

function checkGit(args, context) {
  let dir = context.cwd;
  let i = 0;
  let configured = false;
  while (i < args.length && args[i].startsWith("-")) {
    const flag = args[i++];
    if (flag === "-C") dir = context.resolvePath(args[i++]) ?? dir;
    else if (flag === "-c") { if (/^(remote\..*\.push|push\.)/i.test(args[i] ?? "")) configured = true; i++; }
    else if (/^--config-env/.test(flag) || /^-c./.test(flag)) configured = true;
    else if (flag === "--git-dir" || flag === "--work-tree" || flag === "--namespace") i++;
  }
  if (args[i] !== "push") return;
  const rest = args.slice(i + 1);
  let force = false;
  let remove = false;
  let all = false;
  const positional = [];
  let repoOption = false;
  for (let j = 0; j < rest.length; j++) {
    const word = rest[j];
    if (word === "--") { positional.push(...rest.slice(j + 1)); break; }
    if (/^--force(-with-lease(=.*)?)?$/.test(word)) force = true;
    else if (word === "--mirror") { force = true; all = true; }
    else if (word === "--delete") remove = true;
    else if (word === "--all" || word === "--branches") all = true;
    else if (word === "--repo") { repoOption = true; j++; }
    else if (word.startsWith("--repo=")) repoOption = true;
    else if (["-o", "--push-option", "--receive-pack", "--exec"].includes(word)) j++;
    else if (/^-[a-zA-Z]+$/.test(word)) {
      if (word.includes("f")) force = true;
      if (word.includes("d")) remove = true;
    } else if (!word.startsWith("-")) positional.push(word);
  }
  const refspecs = positional.slice(repoOption ? 0 : 1);
  if (refspecs.some((ref) => ref.startsWith("+"))) force = true;
  if (refspecs.some((ref) => ref.startsWith(":") && ref !== ":")) remove = true;
  if ((force || remove) && refspecs.some((ref) => ref.includes("$"))) ask("could not tell which branch this force push or delete targets.");
  if (!force && !remove) return;
  // `+:` pushes every matching branch; `refs/heads/*:refs/heads/*` every branch.
  if (refspecs.some((ref) => { const spec = ref.replace(/^\+/, ""); return spec === ":" || spec.includes("*"); })) all = true;
  if (all) deny("A force push or delete of all branches can overwrite main.");
  const targets = refspecs.map((ref) => branchName(ref.includes(":") ? ref.slice(ref.indexOf(":") + 1) : ref));
  if (!refspecs.length || targets.includes("HEAD")) {
    // `-c remote.origin.push=HEAD:main` or a saved push mapping can redirect it.
    if (!refspecs.length && (configured || !dir || pushMapped(dir))) ask("could not tell which branch this force push targets: a push mapping may apply.");
    const branch = dir ? currentBranch(dir) : null;
    if (branch === null) ask("could not tell which branch this force push targets.");
    targets.push(branch);
  }
  const hit = targets.find((target) => PROTECTED_BRANCHES.has(target));
  if (hit) deny(`${remove ? "Deleting" : "Force pushing"} ${hit} rewrites shared history.`);
}

// Expands an absolute glob the way bash does, following symlinked folders.
// Returns undefined when there are too many matches to check.
function expand(pattern) {
  const toRegex = (segment) => new RegExp(`^${segment.replace(/[.+^${}()|\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
  let paths = ["/"];
  for (const segment of pattern.split("/").filter(Boolean)) {
    if (!/[*?[]/.test(segment)) { paths = paths.map((path) => join(path, segment)); continue; }
    // Character classes (`[!a]`, `[[:alpha:]]`) are not translated; ask instead.
    if (segment.includes("[")) return undefined;
    const regex = toRegex(segment);
    const next = [];
    for (const path of paths) {
      let entries = [];
      try { entries = readdirSync(path); } catch { continue; }
      for (const entry of entries) {
        if (entry.startsWith(".") && !segment.startsWith(".")) continue;
        if (regex.test(entry)) next.push(join(path, entry));
      }
    }
    if (next.length > 2000) return undefined;
    paths = next;
  }
  // Bash keeps only matches that exist.
  return paths.filter((path) => { try { lstatSync(path); return true; } catch { return false; } });
}

function checkRm(args, context) {
  let recursive = false;
  const targets = [];
  let options = true;
  for (const word of args) {
    if (options && word === "--") options = false;
    else if (options && /^--recursive$/.test(word)) recursive = true;
    else if (options && /^-[a-zA-Z]+$/.test(word)) { if (/[rR]/.test(word)) recursive = true; }
    else if (!(options && word.startsWith("--"))) targets.push(word);
  }
  if (!recursive) return;
  for (const target of targets) {
    // Bash splits `{a,b}` and `{1..3}` into separate targets.
    if (/\{[^}]*(,|\.\.)[^}]*\}/.test(target)) ask(`could not tell which folders the rm target "${target}" expands to.`);
    const globAt = target.search(/[*?[]/);
    // `apps/*/../../x` climbs out after the wildcard; the prefix proves nothing.
    if (globAt !== -1 && target.slice(globAt).split("/").includes("..")) ask(`could not tell where the rm target "${target}" ends up.`);
    const literal = globAt === -1 ? target : dirname(target.slice(0, globAt) + "x");
    // A `cd` inside `( … )` or `$( … )` does not move this shell, so after any
    // `cd` a target that climbs with `..` cannot be placed reliably.
    if (context.cdSeen && !isAbsolute(target) && target.split("/").includes("..")) ask(`could not tell where the rm target "${target}" ends up after a cd.`);
    const path = context.resolvePath(literal);
    if (path === undefined) ask(`could not resolve the rm target "${target}".`);
    if (globAt !== -1) {
      // Check every match too: a wildcard can pass through a symlinked folder.
      let matches;
      matches = expand(context.resolvePath(target));
      // `apps/*/` follows a matched symlink, like `linked/` below.
      if (matches && /\/\.?$/.test(target)) matches = matches.map((match) => `${match}/`);
      if (matches === undefined) ask(`could not expand the rm target "${target}".`);
      for (const match of matches) {
        const full = isAbsolute(match) ? match : join(context.cwd ?? "/", match);
        if (!context.isDeletable(full)) deny(`Recursive rm of "${target}" reaches ${full}, outside the project.`);
      }
    }
    // `rm -rf dist*` in a root only reaches named children; `rm -rf *` or `.*`
    // reaches everything in it, which counts as deleting the root.
    const named = globAt !== -1 && !target.slice(0, globAt).includes("/") && !/^[.*?]*$/.test(basename(target));
    const ok = context.isDeletable(path) || (named && context.isRoot(path));
    if (!ok) deny(`Recursive rm of "${target}" (${path}) reaches outside the project, or deletes a project root.`);
  }
}

function checkConvex(args, env) {
  const key = env.CONVEX_DEPLOY_KEY ?? exported.CONVEX_DEPLOY_KEY;
  if (key) deny("A Convex command with CONVEX_DEPLOY_KEY targets a cloud deployment.");
  const sub = args.find((word) => !word.startsWith("-"));
  if (sub === "deploy") deny("convex deploy ships the backend; merges deploy it through CI.");
  const name = optionValue(args, ["--deployment-name", "--deployment"]);
  if (args.some((word) => word === "--prod" || word.startsWith("--prod=")) || (name && /^prod/.test(name))) deny("Convex commands against the production deployment are not run by agents.");
}

function optionValue(args, names) {
  for (let j = 0; j < args.length; j++) {
    for (const name of names) {
      if (args[j] === name) return args[j + 1] ?? "";
      if (name.startsWith("--") && args[j].startsWith(`${name}=`)) return args[j].slice(name.length + 1);
    }
  }
  return undefined;
}

function checkEas(args) {
  const sub = args.find((word) => !word.startsWith("-")) ?? "";
  if (sub === "submit" || sub.startsWith("submit:")) deny("eas submit uploads to the App Store or Play Store; that stays with Eric.");
  if (args.some((word) => word === "--auto-submit" || word.startsWith("--auto-submit-with-profile"))) deny("--auto-submit uploads to the App Store or Play Store; that stays with Eric.");
  if (sub === "deploy" && args.some((word) => word === "--prod" || word === "--production")) deny("eas deploy --prod ships the production web app.");
  if (sub === "build") {
    if (args.includes("--local")) return;
    const profile = optionValue(args, ["--profile", "-e"]);
    if (profile === undefined) deny("eas build without --profile builds the production profile; store builds ship only after Eric's card.");
    if (/prod/.test(profile)) deny("Production store builds ship only after Eric's card.");
    return;
  }
  const writes = /^(update|channel|branch|env:(create|update|delete|push|unset))/;
  if (writes.test(sub) && args.some((word) => /(^|[=:/])prod(uction)?$/.test(word))) {
    deny("Production OTA updates and production EAS settings run only through the gated job.");
  }
}

function checkWrangler(args) {
  const words = args.filter((word) => !word.startsWith("-"));
  const [sub, second] = words;
  const shipping = sub === "deploy" || sub === "publish" || sub === "rollback" || (sub === "versions" && second === "deploy") || (sub === "secret" && ["put", "delete", "bulk"].includes(second));
  if (!shipping) return;
  const environment = optionValue(args, ["--env", "-e"]);
  if (environment === undefined || environment === "" || PRODUCTION.test(environment)) {
    deny(`wrangler ${sub}${second && sub !== "deploy" ? ` ${second}` : ""} without a non-production --env changes the production Worker.`);
  }
}

const SHIP_SCRIPT = /^(deploy|ship)(:(?!dev$).+)?$|(^|:)(prod|production)$/;

function checkScript(program, args) {
  const skip = (from) => {
    let j = from;
    while (j < args.length && args[j].startsWith("-")) {
      if ((PACKAGE_VALUE_FLAGS.includes(args[j]) || (program !== "pnpm" && args[j] === "-w")) ) j++;
      j++;
    }
    return j;
  };
  let j = skip(0);
  let script = args[j];
  if (script === "run" || script === "run-script") {
    j = skip(j + 1);
    script = args[j];
  } else if (program === "npm") return undefined; // npm runs scripts only through `run`
  if (program === "yarn" && script === "workspace") script = args[j + 2];
  if (script && SHIP_SCRIPT.test(script)) deny(`The "${script}" script deploys or ships; merges deploy through CI.`);
  // `pnpm convex deploy` runs the package bin directly.
  if (script && BINS.has(script)) return { program: script, args: args.slice(j + 1) };
  return undefined;
}

const BINS = new Set(["convex", "eas", "eas-cli", "wrangler", "rm", "git"]);

export function check(command, options) {
  const cwdStart = options.cwd;
  const home = options.home;
  const project = options.projectDir;
  const extraRoots = options.additionalDirectories ?? [];
  const tempRoots = options.tempRoots ?? [];
  let cwd = cwdStart;
  exported = {};

  const resolvePath = (raw) => {
    let path = raw;
    if (path === "~" || path.startsWith("~/")) path = home + path.slice(1);
    path = path.replace(/^\$\{?HOME\}?(?=\/|$)/, home);
    if (cwd !== undefined) path = path.replace(/^\$\{?PWD\}?(?=\/|$)/, cwd);
    if (options.tmpdir) path = path.replace(/^\$\{?TMPDIR\}?(?=\/|$)/, options.tmpdir);
    if (/[$~`]/.test(path)) return undefined;
    if (isAbsolute(path)) return path;
    if (cwd === undefined) return undefined;
    return `${cwd}/${path}`;
  };
  const inside = (path, root) => {
    const rel = relative(root, path);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  };
  // Compares real locations: a symlinked folder inside the project that points
  // elsewhere does not make its target deletable. The last part stays as is,
  // since `rm -rf link` removes only the link.
  // Walks the path in filesystem order, so `linked/../x` climbs from the
  // symlink's target the way the kernel does.
  // A trailing slash (`linked/`) makes rm follow the last part too.
  const real = (path) => {
    const parts = path.split("/").filter((part) => part !== "" && part !== ".");
    const last = /\/\.?$/.test(path) ? undefined : parts.pop();
    let current = "/";
    for (const part of parts) {
      if (part === "..") { current = dirname(current); continue; }
      const next = join(current, part);
      let link = false;
      try { link = lstatSync(next).isSymbolicLink(); } catch { /* missing: keep lexical */ }
      if (link) {
        try { current = realpathSync(next); } catch { current = next; }
      } else current = next;
    }
    if (last === undefined) return current;
    return last === ".." ? dirname(current) : join(current, last);
  };
  const realRoot = (root) => { try { return realpathSync(root); } catch { return resolve(root); } };
  const roots = [project, ...extraRoots, ...tempRoots].filter(Boolean).map(realRoot);
  // A root itself or a folder holding one (a checkout under /tmp) is never
  // deletable, even when another allowed root contains it.
  const isDeletable = (path) => {
    const target = real(path);
    if (roots.some((root) => root === target || inside(root, target))) return false;
    return roots.some((root) => inside(target, root));
  };
  const isRoot = (path) => roots.some((root) => root === real(path));
  let cdSeen = false;
  const context = { get cwd() { return cwd; }, get cdSeen() { return cdSeen; }, resolvePath, isDeletable, isRoot };

  // `inherited` holds variables set for a wrapping command (`KEY=x sh -c '…'`).
  const visit = (commands, inherited = {}) => {
    for (const raw of commands) {
      const unwrapped = unwrap(raw);
      const scoped = { ...inherited, ...(unwrapped.env ?? {}) };
      const saved = cwd;
      for (const dir of unwrapped.chdir ?? []) cwd = dir === undefined ? undefined : resolvePath(dir);
      // A child shell or a wrapper's directory change does not reach the
      // commands after it; `eval` runs in the current shell, so its `cd` does.
      const restore = unwrapped.subshell || (unwrapped.chdir ?? []).length > 0;
      if (unwrapped.nested) {
        visit(unwrapped.nested, scoped);
        if (restore) cwd = saved;
        continue;
      }
      const { words } = unwrapped;
      const env = scoped;
      if (!words.length) { if (restore) cwd = saved; continue; }
      const program = programName(words[0]);
      const args = words.slice(1);
      if (program === "cd") {
        cdSeen = true;
        const target = args.find((word) => !word.startsWith("-"));
        cwd = restore ? saved : target === undefined ? home : resolvePath(target);
        continue;
      }
      dispatch(program, args, env);
      if (restore) cwd = saved;
    }
  };
  const dispatch = (program, args, env) => {
    if (program === "rm") checkRm(args, context);
    else if (program === "git") checkGit(args, context);
    else if (program === "convex") checkConvex(args, env);
    else if (program === "eas" || program === "eas-cli") checkEas(args);
    else if (program === "wrangler") checkWrangler(args);
    else if (["pnpm", "npm", "yarn", "bun"].includes(program)) {
      const bin = checkScript(program, args);
      if (bin) dispatch(bin.program, bin.args, env);
    }
  };
  visit(parse(command));
}

// Returns null when the command may go on to the normal permission flow, or
// { decision: "deny" | "ask", reason } otherwise.
export function evaluate(command, options) {
  try {
    check(command, options);
    return null;
  } catch (error) {
    if (error instanceof Decision) return { decision: error.kind, reason: error.reason };
    return { decision: "ask", reason: `could not check the command (${error.message}).` };
  }
}

// ------------------------------------------------------------------- main

function additionalDirectories(projectDir) {
  try {
    const settings = JSON.parse(readFileSync(join(projectDir, ".claude", "settings.json"), "utf8"));
    const dirs = settings?.permissions?.additionalDirectories;
    return Array.isArray(dirs) ? dirs.filter((dir) => typeof dir === "string").map((dir) => resolve(projectDir, dir)) : [];
  } catch {
    return [];
  }
}

function emit(result) {
  if (!result) process.exit(0);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: result.decision,
        permissionDecisionReason: `irreversible-guard: ${result.reason}`,
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
    emit({ decision: "ask", reason: "could not read the tool input." });
  }
  const command = input?.tool_input?.command;
  if (typeof command !== "string") process.exit(0);
  const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
  const projectDir = process.env.CLAUDE_PROJECT_DIR || cwd;
  const temp = [tmpdir(), "/tmp", "/private/tmp", "/var/folders", "/private/var/folders"];
  emit(evaluate(command, {
    cwd,
    home: homedir(),
    projectDir,
    additionalDirectories: additionalDirectories(projectDir),
    tempRoots: [...new Set(temp.map((dir) => resolve(dir)))].filter((dir) => dir !== sep),
    tmpdir: tmpdir(),
  }));
}
