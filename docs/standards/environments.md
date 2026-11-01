---
type: standard
kind: platform
description: Read when adding, routing, or checking environment variables and secrets.
version: 2.1.0
applies_to: [all]
---

# Environment routing

Environment values come from one manifest and secret store and land only in their declared destinations.

## Rules

Read the nonsecret Infisical project reference from .infisical.json. Source values are captured as JSON in memory for explicit environment/folders; later folders override earlier ones. There is no intermediate secret export file and no infisical run wrapper. Authenticate the provider CLIs separately.

Entries declare names, optionality, secret/public intent, and consumer landings. VITE_/EXPO_PUBLIC_ values are public; secret routes to those consumers fail validation. placementsFor returns explicit destinations (file, Convex, Worker, GitHub, or EAS) and identifies values supplied by workspace/CI ownership. `--pr` supplies PR routing context.

Plans and diagnostics contain names/destinations, not values or raw provider output. `--only file` still needs source access but never contacts remote destination providers. Missing required values block readiness. Missing optional values preserve existing values; empty source values are not written. Dotenv output preserves literal dollars for Vite/Expo; incompatible mixed expansion requirements fail before writing.

Only recognized generated files are updated. Existing markers and .appelent/env-state.json remain compatible with the previous engine. Keep that state and .appelent/env.lock/ out of Git. `--prune` removes only proven owned keys and retains ownership active in another environment. Production pruning requires --yes or typed confirmation; untracked keys and retired destinations need deliberate review. Provider writes are not one transaction: inspect plan/check after partial failure before retrying.

`exec <environment> -- <command>` runs a local command with the selected placements' source values added to its environment, under their destination names, so a tool can read values its provider will not serve locally (for example "Secret" EAS variables in `eas build --local`). Select with `--only`/`--pr`. Values are never written or printed. Findings go to stderr; a missing required value or one name with two different values stops the command. The command's exit code is returned.

Provider subprocesses use explicit args without a shell. Convex/GitHub/Worker values use stdin. EAS's --value argument can be visible to local process inspection while running. Worker secret operations may publish a Worker version. Provider name-only checks cannot prove secret equality.

## Implementation

Run `node scripts/env.mjs` from the app root, or pass `--path`. Node 22.15+ and the provider CLIs used by the selected operation are required; no @appelent/dev dependency, global Appelent command, build step, or adjacent checkout is needed.

```sh
node scripts/env.mjs generate
node scripts/env.mjs check
node scripts/env.mjs plan local --only file
node scripts/env.mjs apply local --only file
node scripts/env.mjs check production
node scripts/env.mjs exec preview --only eas -- pnpm --dir apps/mobile exec eas build --platform ios --local
```

The app owns env.manifest.ts, its environment/consumer names, placement functions, and ENV_CONFIG. Start from the [small manifest example](environments/examples/env.manifest.ts) and adapt actual source folders, destinations, and provider references. Import types only from the copied scripts/lib/env/types.ts if useful. Runtime imports from the manifest remain unsupported.

The loader executes trusted app code after Node's built-in TypeScript type stripping. This is not a sandbox or static inspection. Keep the manifest self-contained, use explicit type-only imports, and use erasable types rather than enums, parameter properties, namespaces, or compiler-specific transforms. No-environment check validates the manifest and placeholder-only .env.example without credentials. check-project.mjs does not execute the manifest.

## Verify

Replace the old thin @appelent/dev/env wrapper with the distributed env.mjs and lib directory; existing pnpm env:* aliases can stay. Preserve the manifest, source ordering, names, .env.example, ownership state, and ignore rules. Change implicit type imports to import type if the Node loader rejects them. Test `generate --dry-run`, check, plan, and a selected local apply before replacing live provider flows. `exec` is additive; existing commands are unchanged. Projects that export secrets into a shell before a local tool can switch to `exec`. Toolkit tests use synthetic sources/providers; live credentials and deployment acceptance remain project tasks.

## Exceptions

Record in `CODING_STANDARDS.md`: rule, scope, replacement, reason.
