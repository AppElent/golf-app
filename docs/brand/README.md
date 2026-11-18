---
type: runbook
description: Regenerate and identify Fairway's logo and app icon assets.
version: 1.0.0
---

# Fairway identity

One bold flag on the putting green (APP-274, chosen by Eric on 18 Nov 2026). The yellow flag matches the Play screen's target colour (`course.target`, `#ffd60a`) and stays legible at 29 px and in the iOS tinted appearance.

Colours: icon field `#25935a` → `#0b4a2a`, green `#7fe0a6` with fringe `#5fcf8f`, flag `#ffd60a`, white pole. Dark appearance: field `#123021` → `#050d08`, green `#3fbf7a`. Brand emerald `#1c7a4c` is the pole on light surfaces (splash, lockup). Surrounding app surfaces are ivory `#f3f4ef` and near-black `#08130d`.

- `apps/mobile/assets/images/icon.png`: opaque 1024 px iOS light master, square corners. `icon-dark.png` and `icon-tinted.png`: opaque iOS 18+ dark and tinted appearances (tinted is grayscale on black). `favicon.png`: opaque 48 px derivative.
- `icon-dev.png`, `icon-test.png`, `icon-preview.png`: the light icon with a coloured install-variant band.
- `android-icon-foreground.png`: transparent 1024 px canvas, mark bounded to 540 px so it fits inside the central 66% adaptive safe circle; `-dev`, `-test`, `-preview` add a label pill. `android-icon-background.png`: opaque field. `android-icon-monochrome.png`: white silhouette with matching alpha. Android is parked; these are regenerated but not verified on a device.
- `splash-icon.png`: transparent 400 px mark with an emerald pole, for both app backgrounds.
- `public/logo192.png`, `public/logo512.png`: opaque PWA icons. `public/favicon.ico`: embedded 16/32/48 px PNG frames.
- `fairway-logo.png`: transparent 1200 × 320 horizontal lockup; emerald Avenir Next wordmark, with Avenir/Arial fallback when regenerating elsewhere.

The artwork is vector SVG in `scripts/brand/fairway-icon.mjs`. Run `node scripts/brand/make-icons.mjs` from the repo root with workspace dependencies installed via pnpm; it renders every asset above with sharp and writes a contact sheet to `/tmp/fairway-icon-preview.png`. No new dependencies are required.
