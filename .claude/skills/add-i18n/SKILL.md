---
name: add-i18n
description: Use when adding internationalization to the Fairway web app, or extending the mobile catalog with a new locale or feature area.
---

# add-i18n

[docs/standards/i18n.md](../../../docs/standards/i18n.md) owns the rules: one
catalog, messages as data, and which helpers to copy from
`docs/standards/i18n/examples/`. Helpers are copied into the app, not installed
from a package.

**Where Fairway stands:**
- **Mobile** has its catalog in `apps/mobile/src/i18n/messages/` (English and
  Dutch). Extend the area module that already owns the text.
- **Web** hardcodes English (see "Not yet migrated" in `CODING_STANDARDS.md`).
  Adding it means copying the core, web provider, SSR and optional Clerk sync
  helpers into `src/lib/i18n/`, starting a catalog there, and wiring
  `src/routes/__root.tsx` as the standard describes: resolve the locale in the
  root route's `loader`, set `<html lang>`, and put `LocaleProvider` around the
  existing providers.

## String extraction recipe

The procedure for every incremental extraction task. Copy this section into the
implementation plan, then add a glossary table alongside it.

1. **Find the strings.** For each file in the task's scope, read it and
   identify every user-visible string literal: JSX text nodes, `aria-label`,
   `title`, `placeholder`, `alt`, button labels, toast/error fallback
   messages, and text drawn to canvas. Skip: `className`, route paths,
   keys/ids, `console.*`, code-only constants, and app *content*
   (user-authored or curated data such as course names stays in the source
   language; only the app's own UI chrome gets localized). This
   content-vs-chrome boundary is the most important judgment call in the
   recipe: get it wrong and either translations bleed into data or real UI
   strings stay in the default language.
2. **Add source-locale keys.** Create (or extend) a per-feature file exporting
   one object named after the feature (camelCase). Group keys by component; key
   names are camelCase and describe *meaning*, not *position* (`saveRound`, not
   `button1`: a key named for its screen position breaks the moment the layout
   changes). Dynamic values become `{placeholder}` tokens rendered with
   `fmt(...)`; counts use `plural(locale, n, { one, other })` with `{count}` in
   both forms.
3. **Register the feature object** in the source locale's top-level catalog
   file (and the target locale's twin).
4. **Author the target-locale file** with the same shape (`satisfies` the
   source-locale type). Translate meaning, not words; keep it short enough for
   the same UI space; follow the app's own tone and glossary.
5. **Replace the literals.** In each component, pull in `const { messages,
   locale } = useI18n();` (or only what's needed) and replace literals with
   `messages.<feature>.<group>.<key>`, `fmt(...)` for placeholders. Never import
   the i18n React context into business-logic files; pass the messages object
   or the needed strings in as a parameter. A canvas draw loop cannot call hooks
   at all, so read the needed strings once via `useMessages()` in the owning
   component, bundle them into a plain object, and thread that object through
   the draw functions, keeping it fresh with a ref if the loop runs outside
   React's render cycle.
6. **Verify:** typecheck (a missing target-locale key fails here, because of the
   `satisfies` constraint), run the message parity test (`assertMessageParity`),
   then the touched feature's own test suite.
7. **Commit** only the files listed in the task. If a target file already has
   unrelated uncommitted changes, still make the i18n edits to it, but leave it
   uncommitted rather than bundling unrelated diffs into an i18n-scoped commit.
