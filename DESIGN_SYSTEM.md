---
version: 2.2.0
description: Design rules selected by platform and interaction.
---

# Design system

<!-- appelent-standards:start -->
## Shared guidance

For UI work, read [general design](docs/standards/general-design.md) and the affected platform:

| Platform | Read |
| --- | --- |
| Browser | [Web design](docs/standards/web-design.md) |
| Native | [Mobile design](docs/standards/mobile-design.md), plus [iOS](docs/standards/ios-design.md) or [Android](docs/standards/android-design.md) |

When the task matches a row, also read:

| Task | Read |
| --- | --- |
| Entering or adjusting a numeric value | [Number fields](docs/standards/number-fields.md) |
| Fullscreen, sheet, or keyboard-anchored editing, or drafts | [Editors](docs/standards/editors.md) |
| Row actions, selection, or section menus in a list | [Actionable lists](docs/standards/lists.md) |
| Creating, reviewing, or building from a design study | [Design studies](docs/standards/design-studies.md) |

Project decisions below bind these standards to product components, identity, and justified exceptions.
Conform, improve, or differ as described in [working with standards](CODING_STANDARDS.md#working-with-standards).
<!-- appelent-standards:end -->

## Design System artifact

The canvas design system is the [Fairway Design System artifact](https://claude.ai/artifact/7wJEEjq25dsdd5zmmxiwpN).
Designers and coding agents start from it; product decisions below still bind the code.

## Project decisions

### Mobile (`apps/mobile`)

- **Two looks:** the app's own screens follow the platform (iOS: SwiftUI lists,
  native sheets and toolbars, Liquid Glass; Android: Material). The on-course
  Play screen follows Golfshot GPS: satellite imagery tee → green with a yellow
  target line, distance labels, F/C/B numbers and hazard callouts.
- **Course palette:** the `course` tokens in `src/theme/tokens.ts` are chosen for
  contrast against imagery and are not themed; Play looks the same in light and
  dark mode. Everything else uses `useTokens()`.
- **Light-scheme green:** `accentFill` and `accent` are both `#1a7348`, so white
  `onAccent` labels on primary buttons and selected segments reach 5.85:1;
  `accentPressed` is the darker `#135a37`, so a press is visible in light mode.
- **Eagle** is a chart mark, not text: light `#c07000` keeps 3:1 against `bg`,
  `surface` and `surface2`. Dark is unchanged.
- **Swipe actions:** the glyph on a swipe capsule is `onSwipe`, never a literal.
- **Live Activity** (`features/live/hole/hole-activity.tsx`) runs in the widget
  runtime and cannot import tokens, so it declares its palette inline; its
  `target` must equal `course.target` (`#ffd60a`).
- **Tee marker colours** live in `@fairway/core/tee-colors` and are shared by the
  phone's `course.teeMarker` and the web hole map.
- **HUD controls** float in `HudGlass` (Liquid Glass on iOS 26+, dark translucent
  fill elsewhere). The primary action (Score hole N) is the yellow pill.
- **Building blocks:** lists use `InsetList`/`InsetRow`, forms `FormScreen` and its
  rows, text `AppText` variants (never a literal `fontSize`), empty states
  `EmptyState`, loading `SkeletonList`/`SkeletonCard`, confirmation `useConfirm`,
  errors `useToast().error`.
- **Copy:** every string is in `src/i18n/messages/*` in English and Dutch.
- **The Score hole pill** uses `radius.pill`, like every other pill.

### Web (`src/`)

- **Fonts:** body text is **Hanken Grotesk** (`--font-sans`); titles, numbers,
  pills and the CTA are **Space Grotesk** (`font-display`). Both come from the
  one Google Fonts import. Manrope was named in `--font-sans` but never loaded,
  so body text fell back to the system font. Hanken Grotesk was already loaded
  and pairs with Space Grotesk, so we chose it over adding a third face.
- **Type scale:** never `text-[Npx]`. Use the named sizes in `src/styles.css`:
  `text-nano` 9, `text-micro` 10, `text-caption` 11, `text-footnote` 12,
  `text-label` 13 (the default small text), `text-callout` 14, `text-body` 15,
  `text-control` 16, `text-row` 17, `text-title-sm` 22, `text-hero` 44,
  `text-jumbo` 56. Two old sizes were folded in: 10.5 (bottom-nav labels)
  became `text-caption` 11, and 12.5 became `text-label` 13.
- **Colour roles:** `flag` and `live` are fills under white text. Text in those
  hues uses `flag-ink` and `live-ink`, which pass on cream and on a `/15` tint.
  On the pine Play screen, error text is `flag-soft` and quiet text `mint-soft`;
  `stone` and `moss` are for cream and white cards only.
- **Links:** `--page-link` is themed with the app column (light `#246f76`,
  hover `--page-link-hover`; dark `#6fcfc6`). The link rule sits in the base
  layer, so a `text-*` class on a link (bottom nav, inline links) applies.
- **Dark theme** (APP-191) follows the system setting; there is no toggle. The
  app column takes the phone's dark palette (`apps/mobile` tokens) through the
  themed tokens in `src/styles.css`: `canvas` (column background), `surface`
  (cards, unselected controls), `field` (inputs), `bar` (tab bar),
  `card-line`, `control-line` (the edge of a field, button or toggle; use
  `CONTROL` or `FIELD` from `src/components/classes.ts`), `ink`, `moss`, `stone`,
  `on-stone`, `live-ink`, `flag-ink`,
  `pine-ink` (pine text, icons and rings, mint in dark) and `pine-fill` (a pine
  button under cream text, lifted in dark so it stands off the canvas). Never
  `bg-cream`, `bg-white/N` or `text-pine` in the column. The brand fills
  (`pine` and `pine-light` for the Play screen, `flag`, `live`, `mint`) and the
  `map-*` colours, including `map-ink` for hole-map labels, are not themed.
  `src/theme.test.ts` checks every text token against every ground and tint
  in both themes. Field placeholders are `stone`. Clerk's sign-in card takes
  the same tokens in dark mode through `appearance` variables
  (`src/integrations/clerk/appearance.ts`) and keeps Clerk's own look in light.
  Its primary is `pine-ink` (mint) with a `canvas` label, because Clerk also
  draws its links in the primary colour.
- **Map colours** in `src/play/` use `--color-map-*` tokens and the shared tee
  marker colours, never hex.

### Contrast

Every text pair reaches 4.5:1 in both themes; marks (chart fills, control
edges) reach 3:1. Ratios are WCAG 2 relative luminance, with translucent colours
composited over their ground. Pairs changed in APP-184 and APP-191 (bold =
failed before). The APP-184 web rows were measured when the app column was
cream in both themes; since APP-191 the dark column has its own rows below
them. Known gap: light-mode control edges (fields, bordered buttons and
toggles: `control-line` = `card-line`, 1.12:1 on cream) stay as they were,
because APP-191 keeps light mode unchanged. Its deliberate light-mode changes are
contrast fixes only: field placeholders, the selected scorecard hole's labels
and the "Connecting…" note (`text-muted`, near-white, → `stone`).

| Pair | Theme | Old | New |
| --- | --- | --- | --- |
| Web: `stone` text on cream | light + dark | **2.68** | 4.62 |
| Web: `stone` text on white/60 card | light + dark | **2.91** | 5.03 |
| Web: `stone` text on white/90 nav | light + dark | **3.03** | 5.24 |
| Web: green text on cream (`live` → `live-ink`) | light + dark | **2.95** | 5.64 |
| Web: green text on a `live/15` tint (SyncPill) | light + dark | **2.54** | 4.65 |
| Web: white on `live` (selected PillToggle) | light + dark | **3.39** | 5.30 |
| Web: white on `flag` (CTA) | light + dark | **3.85** | 4.99 |
| Web: Home CTA subtitle (white/80 → white) on `flag` | light + dark | **2.99** | 4.99 |
| Web: error text on cream (`flag` → `flag-ink`) | light + dark | **3.36** | 5.74 |
| Web: error text on a `flag/15` tint (SyncPill offline) | light + dark | **2.81** | 4.67 |
| Web: error text on pine Play (`flag` → `flag-soft`) | light + dark | **3.17** | 6.35 |
| Web: OSM credit on pine Play (`stone` → `mint-soft`) | light + dark | **3.97** | 6.54 |
| Web: Play "No active round" text on cream (`mint-soft` → `moss`) | light + dark | **1.62** | 4.70 |
| Web: link on `page-base` | light | **3.34** | 5.10 |
| Web: link in the app column (cream) | light | **3.32** | 5.06 |
| Web: link in the app column (cream) | dark | **1.27** | 5.06 |
| Web: bottom-nav inactive tab (link colour → `stone`) | light | **3.76** | 5.24 |
| Web: bottom-nav inactive tab (link colour → `stone`) | dark | **1.44** | 5.24 |
| Web: bottom-nav active tab (link colour → `pine`) | light | **3.76** | 12.04 |
| Web: bottom-nav active tab (link colour → `pine`) | dark | **1.44** | 12.04 |
| Web: `ink` / `moss` / `stone` on `canvas` (APP-191; before, the column stayed cream) | dark | cream column | 17.18 / 7.77 / 6.30 |
| Web: `stone` on `field`, the lowest dark text pair (APP-191) | dark | cream column | 4.89 |
| Web: `live-ink` / `flag-ink` / `pine-ink` on `canvas` (APP-191) | dark | cream column | 11.82 / 9.85 / 11.82 |
| Web: link on `canvas` (APP-191) | dark | 5.06 (cream column) | 10.29 |
| Web: cream on `pine-fill` (APP-191); the fill itself is 3.14:1 on `canvas`, 2.80:1 on `surface`, carried by its label | dark | 10.62 (`pine`) | 5.25 |
| Web: Clerk sign-in links and primary button (`colorPrimary` `pine-fill` → `pine-ink`): link on `surface` / `canvas` label on the button (APP-191) | dark | **2.80** / 5.25 | 10.53 / 11.82 |
| Web: bottom-nav tabs in the dark column: each on `bar`; active (`pine-ink`, mint) against inactive (`stone`) (APP-191) | dark | cream column | each ≥ 5.67; 1.88 apart, plus the hue change |
| Web: field placeholder (ink at 50% → `stone`) on `field` (APP-191) | light / dark | **3.09** / n/a | 4.62 / 4.89 |
| Web: dark control edge (`control-line`: fields, buttons, toggles) on `field` / `surface` / `canvas` (3:1) (APP-191) | dark | **1.53** (`card-line`) | 3.25 / 3.73 / 4.19 |
| Web: selected scorecard hole number (`stone` → `ink`) on `pine-ink/10` (APP-191) | light / dark | **3.88** / n/a | 11.77 / 14.19 |
| Phone: `onAccent` on `accentFill` (primary button, selected segment) | light | **3.39** | 5.85 |
| Phone: `onAccent` on `accentPressed` | light | **3.39** | 8.25 |
| Phone: `accent` on `bg` | light | 4.82 | 5.29 |
| Phone: `accent` on `surface` | light | 5.33 | 5.85 |
| Phone: `accent` on `surface2` | light | **4.42** | 4.84 |
| Phone: `accent` on `accentDim` over `bg` | light | **4.23** | 4.62 |
| Phone: `accent` on `accentDim` over `surface` | light | 4.66 | 5.08 |
| Phone: `eagle` chart mark on `bg` (3:1) | light | **1.99** | 3.42 |
| Phone: `eagle` chart mark on `surface` (3:1) | light | **2.20** | 3.78 |
| Phone: `eagle` chart mark on `surface2` (3:1) | light | **1.82** | 3.13 |
| Phone: every dark-scheme pair | dark | unchanged | unchanged (already ≥ 4.5) |


