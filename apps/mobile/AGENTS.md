# Fairway mobile (Expo)

Read the repo's `CODING_STANDARDS.md` and `DESIGN_SYSTEM.md` first; their project
decisions cover this app. Project facts (identity, env, builds):
[`docs/runbooks/mobile.md`](../../docs/runbooks/mobile.md).

## Expo changes every SDK — check the docs

Read the `expo` major in `package.json` and use the matching versioned docs
(`https://docs.expo.dev/versions/v<major>.0.0/`), or https://docs.expo.dev/llms.txt.
Do not rely on remembered APIs.

## Layout and commands

`app/` holds Expo Router routes only; screens live in `src/features/` and
`src/ui/` never imports features. `pnpm check:mobile-structure` (part of
`pnpm check`) enforces the layout ([mobile structure](../../docs/standards/mobile-structure.md)).
Commands: [`docs/runbooks/mobile.md`](../../docs/runbooks/mobile.md). Use pnpm,
never npm/npx/yarn.

Run `pnpm verify` before declaring work done, and drive the changed flow on a simulator.

## Rules

- `ios/` and `android/` are generated and gitignored; configure native behaviour
  in `app.json` / `app.config.ts` and config plugins.
- A new native module needs a rebuilt dev client.
- EAS cloud builds and store submissions are release steps for the owner, not
  part of routine work.
