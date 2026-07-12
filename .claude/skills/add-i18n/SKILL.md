---
name: add-i18n
description: Use when adding internationalization to an Appelent TanStack Start + Clerk app, or extending an existing i18n setup with a new locale/feature area. Installs @appelent/i18n and scaffolds the app-specific wiring (message trees, root route, language toggle).
---

# add-i18n

Scaffolds internationalization for a TanStack Start + Clerk app using the
shared `@appelent/i18n` package (GitHub Packages, `D:\Dev\appelent-packages\packages\i18n`)
for the engine, plus per-app scaffolding for the parts that can't be shared:
message dictionaries and UI wiring.

**Split of responsibilities** — don't blur this line:
- **`@appelent/i18n` (the package)**: locale resolution (`resolveLocale`,
  `isLocale`), `fmt`/`plural` interpolation, the `createI18n()` factory
  (React context/provider/hooks), `createGetSsrLocale()` (SSR server fn
  factory), `createLanguageSync()` (optional Clerk metadata mirror), and
  `assertMessageParity()` (test helper). Bug fixes to this logic land in the
  package, not copy-pasted into each app.
- **This skill (scaffolded, copy-pasted per app)**: the app's own
  `messages/{locale}/` dictionary, `__root.tsx` wiring, and the
  `LanguageToggle` component (styling is app-specific chrome, matches each
  app's own header). Editing these after scaffolding is expected and normal.

Before starting: check `C:\Users\ericj\.claude\appelent\capabilities.json`
for the `i18n` entry (should show `package: "@appelent/i18n"`, `status:
"active"`) and confirm the target project's `package.json`/`.npmrc` already
supports installing from the private GitHub Packages registry (see how
`@appelent/auth` is wired in for the pattern to copy).

## 1. Install the package

```bash
pnpm add @appelent/i18n
```

If the app uses `@appelent/auth`/Clerk already, also ensure
`@clerk/clerk-react` is present (it should be, via `@appelent/auth`'s peer
dep) — the optional Clerk sync helper needs it.

## 2. Scaffold the message tree

Adjust the locale list to the target app's actual languages — `en`/`nl` is
the concrete example below (from Arcade Club, where this pattern was first
built out), but the pattern is locale-count-agnostic.

### `src/lib/i18n/messages/en/common.ts` — base vocabulary (start every app with this)

These are the generic, app-agnostic UI chrome terms pulled from Arcade
Club's proven `common.ts` — copy them verbatim as the starting point, then
add the target app's own domain-specific groups alongside `actions`/`errors`:

```ts
export const common = {
	actions: {
		start: "Start",
		cancel: "Cancel",
		close: "Close",
		save: "Save",
		delete: "Delete",
		copy: "Copy",
		copied: "Copied!",
		retry: "Try again",
		back: "Back",
	},
	errors: {
		somethingWentWrong: "Something went wrong. Please try again.",
		notFound: "Not found.",
		loading: "Loading…",
	},
};
```

`src/lib/i18n/messages/en/index.ts`:

```ts
import { common } from "./common";

export const en = { common };
export type Messages = typeof en;
```

`src/lib/i18n/messages/nl/common.ts` (same shape, `satisfies` the English
type guarantees no missing/extra key — this is the whole point of the
pattern: delete a key from `en/common.ts` and `nl/common.ts` fails to
typecheck until you delete it there too):

```ts
import type { common as enCommon } from "../en/common";

export const common = {
	actions: {
		start: "Start",
		cancel: "Annuleren",
		close: "Sluiten",
		save: "Opslaan",
		delete: "Verwijderen",
		copy: "Kopiëren",
		copied: "Gekopieerd!",
		retry: "Opnieuw proberen",
		back: "Terug",
	},
	errors: {
		somethingWentWrong: "Er ging iets mis. Probeer het opnieuw.",
		notFound: "Niet gevonden.",
		loading: "Laden…",
	},
} satisfies typeof enCommon;
```

`src/lib/i18n/messages/nl/index.ts`:

```ts
import type { Messages } from "../en";
import { common } from "./common";

export const nl = { common } satisfies Messages;
```

As the app grows, each feature area gets its own file
(`messages/en/<feature>.ts` + `messages/nl/<feature>.ts`, registered
alongside `common` in both `index.ts` files) rather than one giant
`common.ts` — see the extraction recipe below.

## 3. Wire the engine via `@appelent/i18n`

### `src/lib/i18n/index.ts`

```ts
import { createI18n } from "@appelent/i18n";
import { en, type Messages } from "./messages/en";
import { nl } from "./messages/nl";

export const SUPPORTED_LOCALES = ["en", "nl"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type { Messages };

export const {
	LocaleProvider,
	useI18n,
	useMessages,
	readClientLocale,
	hasExplicitLocaleChoice,
} = createI18n<Locale, Messages>({
	locales: SUPPORTED_LOCALES,
	fallback: "en",
	messages: { en, nl },
});

export { fmt, plural } from "@appelent/i18n";
```

### `src/lib/i18n/server.ts`

```ts
import { createGetSsrLocale } from "@appelent/i18n/server";
import { SUPPORTED_LOCALES, type Locale } from "./index";

export const getSsrLocale = createGetSsrLocale(SUPPORTED_LOCALES, "en" satisfies Locale);
```

`getSsrLocale()` returns `{ locale: string }` (see the package's note on why
it isn't typed as `Locale` directly — a TanStack server fn serialization
constraint, not a real ambiguity, since `resolveLocale` only ever returns one
of `locales`). Cast at the call site: `const { locale } = (await
getSsrLocale()) as { locale: Locale };`.

### `src/lib/i18n/LanguageSync.tsx` — only if the app uses `@appelent/auth`/Clerk

```tsx
import { createLanguageSync } from "@appelent/i18n/clerk-sync";
import { hasExplicitLocaleChoice, SUPPORTED_LOCALES, useI18n } from "./index";

export const LanguageSync = createLanguageSync({
	useI18n,
	hasExplicitLocaleChoice,
	locales: SUPPORTED_LOCALES,
});
```

Skip this file entirely if the app has no auth.

### `src/components/LanguageToggle.tsx` — header toggle button

Styled to match the app's existing `ThemeToggle` component — adjust
classNames to the target app's actual header button styling; the structure
(button, `aria-label`+`title` both set from the same `fmt()` call, `onClick`
flips to the other locale) is the reusable part.

```tsx
import { fmt, useI18n } from "#/lib/i18n";

const LOCALE_NAMES = { en: "English", nl: "Nederlands" } as const;

export default function LanguageToggle() {
	const { locale, messages, setLocale } = useI18n();
	const next = locale === "en" ? "nl" : "en";
	const label = fmt(messages.common.header.switchLanguage, {
		language: LOCALE_NAMES[next],
	});

	return (
		<button
			type="button"
			onClick={() => setLocale(next)}
			aria-label={label}
			title={label}
			className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/15"
		>
			{locale.toUpperCase()}
		</button>
	);
}
```

(Add a `header.switchLanguage: "Switch to {language}"` key to `common.ts` if
the app's base vocabulary doesn't already have one — it's UI chrome, not
part of the shared base list above, since header layout varies per app.)

## 4. Root route wiring

Diff against the target app's `src/routes/__root.tsx` — three concerns:
resolve the locale in the route `loader` (client vs. SSR branch, so no
client-side round-trip after hydration), set `<html lang>`, and mount
`LocaleProvider` as the outermost `<body>` wrapper (everything else —
`ClerkProvider`, app providers, `Header`/`Footer`, `children` — nests inside
it; `<Scripts/>` stays a sibling outside `<body>`'s content, not wrapped).

```diff
+import { LocaleProvider, readClientLocale, type Locale } from "#/lib/i18n";
+import { LanguageSync } from "#/lib/i18n/LanguageSync";
+import { getSsrLocale } from "#/lib/i18n/server";

 export const Route = createRootRouteWithContext<MyRouterContext>()({
   head: () => ({ /* ... */ }),
+  loader: async () => {
+    if (typeof document !== "undefined") {
+      return { locale: readClientLocale() };
+    }
+    const { locale } = (await getSsrLocale()) as { locale: Locale };
+    return { locale };
+  },
   shellComponent: RootDocument,
 });

 function RootDocument({ children }: { children: React.ReactNode }) {
+  const { locale } = Route.useLoaderData();
   return (
-    <html suppressHydrationWarning>
+    <html lang={locale} suppressHydrationWarning>
       <head>
         <HeadContent />
         <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
       </head>
       <body className="...">
+        <LocaleProvider initialLocale={locale}>
           <ClerkProvider>
             <ConvexProvider>
               <ThemeSync />
+              <LanguageSync />
               {!isFullscreen && <Header />}
               {children}
               {!isFullscreen && <Footer />}
               <TanStackDevtools ... />
             </ConvexProvider>
           </ClerkProvider>
+        </LocaleProvider>
         <Scripts />
       </body>
     </html>
   );
 }
```

Then wire `LanguageToggle` into `Header.tsx` next to (or in place of) the
existing theme toggle — component-specific, no universal diff to give here;
follow the app's own header layout.

## 5. Tests

`src/lib/i18n/__tests__/messages.test.ts` — the load-bearing test, using the
package's shared parity checker instead of hand-rolled leaf-collection logic:

```ts
import { assertMessageParity } from "@appelent/i18n/test-utils";
import { en } from "../messages/en";
import { nl } from "../messages/nl";

assertMessageParity({ en, nl });
```

This recursively asserts identical key sets between locales, no empty
strings, and identical `{placeholder}` tokens per message pair — it's what
makes every later extraction task (below) provably correct. No app-specific
`core.test.ts` is needed; `resolveLocale`/`fmt`/`plural`/`isLocale` are
tested inside the `@appelent/i18n` package itself.

## String extraction recipe

The exact procedure for every incremental extraction task once the
scaffolding above is in place. Copy this section into the app-specific
implementation plan, then add a project-specific glossary table alongside it
— glossaries are per-app domain vocabulary, not part of this reusable
recipe.

1. **Find the strings.** For each file in the task's scope, read it and
   identify every user-visible string literal: JSX text nodes, `aria-label`,
   `title`, `placeholder`, `alt`, button labels, toast/error fallback
   messages, and text drawn to canvas. Skip: `className`, route paths,
   keys/ids, `console.*`, code-only constants, and app *content*
   (user-authored or curated data — quiz questions, puzzle words, song/
   artist metadata — content stays in the source/default language; only the
   app's own UI chrome gets localized). This content-vs-chrome boundary is
   the single most important judgment call in the whole recipe — get it
   wrong and either translations bleed into data or real UI strings get left
   in the default language.
2. **Add source-locale keys.** Create (or extend) a per-feature file
   exporting one object named after the feature (camelCase). Group keys by
   component; key names are camelCase and describe *meaning*, not *position*
   (`rollDice`, not `button1` — a key named for its screen position breaks
   the moment the layout changes). Dynamic values become `{placeholder}`
   tokens rendered with `fmt(...)`; counts use `plural(locale, n, { one,
   other })` with `{count}` in both forms.
3. **Register the feature object** in the source locale's top-level
   `index.ts` (and the target locale's twin).
4. **Author the target-locale file** with the same shape (`satisfies` the
   source-locale type — see the `common.ts`/`common` pattern above).
   Translate meaning, not words; keep it short enough for the same UI space;
   follow the app's own tone/glossary rules.
5. **Replace the literals.** In each component, pull in `const { messages,
   locale } = useI18n();` (or only what's needed) and replace literals with
   `messages.<feature>.<group>.<key>`, `fmt(...)` for placeholders. For
   non-React code paths (canvas render loops, pure helpers, anything under a
   `lib/games`-style logic-only directory): never import the i18n React
   context into game/business-logic files — pass the messages object or the
   specific needed strings in as a parameter instead. A canvas draw loop
   specifically cannot call hooks at all (it isn't React render code), so
   read the needed strings once via `useMessages()` in the owning component,
   bundle them into a plain object, and thread that object as a parameter
   through the render/setup/draw function chain — keep it fresh across
   re-renders with a ref if the draw loop runs outside React's render cycle
   (`requestAnimationFrame`, not a render return).
6. **Verify:** typecheck (parity: a missing target-locale key fails here,
   because of the `satisfies` constraint), run `messages.test.ts`
   (placeholder parity via `assertMessageParity`), then the touched
   feature's own test suite.
7. **Commit** only the files listed in the task. If a target file already
   has unrelated pre-existing uncommitted changes (a separate in-flight
   feature sharing the file), still make the i18n edits to it, but exclude
   it from this commit's `git add` — leave it uncommitted in the working
   tree rather than bundling unrelated diffs into an i18n-scoped commit.

## Notes

- **Adding a locale:** extend `SUPPORTED_LOCALES` in the app's
  `src/lib/i18n/index.ts`, add a full `messages/<locale>/` tree (typecheck
  will list every missing file/key via the `satisfies` chain — this is the
  mechanism doing the work, not a manual checklist), extend `LOCALE_NAMES` in
  `LanguageToggle.tsx`.
- **When to migrate off this pattern** to a real i18n library
  (`react-i18next`, `next-intl`, etc.): once locale count grows past 2-3,
  once translations start coming from external translators/a TMS rather than
  the developer editing `.ts` files directly, or once the app needs runtime
  locale switching without a full page's worth of typed keys (e.g.
  CMS-driven content). This dictionary's shape maps 1:1 onto JSON message
  catalogs, so migrating later is a mechanical export, not a redesign — don't
  reach for a library upfront just because "real apps use i18next."
