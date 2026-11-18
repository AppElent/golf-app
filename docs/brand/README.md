---
type: runbook
description: Regenerate and identify Fairway's logo and app icon assets.
version: 1.0.0
---

# Fairway identity

A curving fairway with a bunker leads up to a green with a white pin and a yellow flag (APP-274, chosen by Eric on 18 Nov 2026). The yellow flag matches the Play screen's target colour (`course.target`, `#ffd60a`).

Colours: icon field `#1cb45d` → `#013a27`, mint fairway, sand bunker, yellow flag. Dark appearance: near-black pine field `#12301f` → `#050d08` with the same hole slightly dimmed. Surrounding app surfaces are ivory `#f3f4ef` and near-black `#08130d`; brand emerald `#1c7a4c` is the wordmark colour.

## Masters (`docs/brand/icon/`)

- `light.png`: the generated artwork (Codex image generation, 18 Nov 2026), opaque square, full bleed, no text.
- `dark.png`, `tinted.png`, `mark.png`: derived from `light.png` by `scripts/brand/derive-appearances.py` (numpy + Pillow). It fits a smooth background to the border, keeps the hole, and swaps the field for the dark gradient (dark), maps the hole's luminance to grayscale on black (tinted), or keeps the hole on a transparent canvas (mark).

## Generated assets

- `apps/mobile/assets/images/icon.png`, `icon-dark.png`, `icon-tinted.png`: opaque 1024 px iOS appearances. `favicon.png`: opaque 48 px derivative.
- `icon-dev.png`, `icon-test.png`, `icon-preview.png`: the light icon with a coloured install-variant band.
- `android-icon-foreground.png`: transparent 1024 px canvas, mark bounded to 540 px so it fits inside the central 66% adaptive safe circle; `-dev`, `-test`, `-preview` add a label pill. `android-icon-background.png`: opaque field. `android-icon-monochrome.png`: white silhouette with matching alpha. Android is parked; these are regenerated but not verified on a device.
- `splash-icon.png`: transparent 400 px mark for both app backgrounds.
- `public/logo192.png`, `public/logo512.png`: opaque PWA icons. `public/favicon.ico`: embedded 16/32/48 px PNG frames.
- `fairway-logo.png`: transparent 1200 × 320 horizontal lockup; emerald Avenir Next wordmark, with Avenir/Arial fallback when regenerating elsewhere.

To change the artwork, replace `docs/brand/icon/light.png`, run `python3 scripts/brand/derive-appearances.py`, then `node scripts/brand/make-icons.mjs` from the repo root with workspace dependencies installed via pnpm. The second script writes every asset above with sharp and a contact sheet to `/tmp/fairway-icon-preview.png`.
