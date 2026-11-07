# Fairway mobile (Expo)

Read the repo's `CODING_STANDARDS.md` and `DESIGN_SYSTEM.md` first; their project
decisions cover this app. Project facts (identity, env, builds):
[`docs/runbooks/mobile.md`](../../docs/runbooks/mobile.md).

## Expo changes every SDK — check the docs

Read the `expo` major in `package.json` and use the matching versioned docs
(`https://docs.expo.dev/versions/v<major>.0.0/`), or https://docs.expo.dev/llms.txt.
Do not rely on remembered APIs.

## Layout

- `app/` — Expo Router routes only (`(auth)`, `(app)` with NativeTabs, modal
  sheets). Routes import a screen from `src/features`.
- `src/features/<feature>/<subject>/` — screens, models (`*-model.ts`, pure and
  unit-tested) and hooks. Feature folders: auth, courses, home, live,
  location, play, profile, rounds, stats.
- `src/ui/` — domain-free controls; never imports features.
- `src/theme`, `src/i18n`, `src/convex`, `src/prefs`, `src/auth`, `src/feedback`
  (haptics, reduced motion), `src/monitoring`, `src/updates`.
- `pnpm check:mobile-structure` (part of `pnpm check`) enforces the layout.

## Commands

Use pnpm, never npm/npx/yarn:

```bash
pnpm --filter @fairway/mobile exec expo install <pkg>   # SDK-compatible versions
pnpm --filter @fairway/mobile exec expo start --dev-client
pnpm --filter @fairway/mobile exec expo run:ios         # rebuild the dev client
pnpm test:mobile                                        # Jest
```

Run `pnpm check`, `pnpm typecheck`, `pnpm test` and `pnpm test:mobile` before
declaring work done, and drive the changed flow on a simulator.

## Rules

- `ios/` and `android/` are generated and gitignored; configure native behaviour
  in `app.json` / `app.config.ts` and config plugins.
- A new native module needs a rebuilt dev client.
- EAS cloud builds and store submissions are release steps for the owner, not
  part of routine work.
