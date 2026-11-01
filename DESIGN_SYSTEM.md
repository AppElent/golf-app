---
version: 2.1.0
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

Read a pattern only when building that interaction: [number fields](docs/standards/number-fields.md), [editors](docs/standards/editors.md),
[actionable lists](docs/standards/lists.md), and [design studies](docs/standards/design-studies.md). Project
decisions below bind these standards to product components, identity, and justified exceptions.
Conform, improve, or differ as described in [working with standards](CODING_STANDARDS.md#working-with-standards).
<!-- appelent-standards:end -->

## Project decisions

### Mobile (`apps/mobile`)

- **Two looks:** the app's own screens follow the platform (iOS: SwiftUI lists,
  native sheets and toolbars, Liquid Glass; Android: Material). The on-course
  Play screen follows Golfshot GPS: satellite imagery tee → green with a yellow
  target line, distance labels, F/C/B numbers and hazard callouts.
- **Course palette:** the `course` tokens in `src/theme/tokens.ts` are chosen for
  contrast against imagery and are not themed; Play looks the same in light and
  dark mode. Everything else uses `useTokens()`.
- **HUD controls** float in `HudGlass` (Liquid Glass on iOS 26+, dark translucent
  fill elsewhere). The primary action (Score hole N) is the yellow pill.
- **Building blocks:** lists use `InsetList`/`InsetRow`, forms `FormScreen` and its
  rows, text `AppText` variants (never a literal `fontSize`), empty states
  `EmptyState`, loading `SkeletonList`/`SkeletonCard`, confirmation `useConfirm`,
  errors `useToast().error`.
- **Copy:** every string is in `src/i18n/messages/*` in English and Dutch.
