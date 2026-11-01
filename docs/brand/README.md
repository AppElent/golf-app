---
type: runbook
description: Regenerate and identify Fairway's logo and app icon assets.
version: 1.0.0
---

# Fairway identity

A sweeping fairway leads the eye from tee to putting green and a bold pin. The broad mint ribbon stays recognizable at small sizes, while the emerald edge gives the transparent mark definition on light and dark surfaces.

Colours: emerald `#1c7a4c`, pressed green `#2e9e63`, dark-mode accent `#3fbf7a`, mint `#7fe0a6`; icon field `#2e9e63` → `#0f5c33`. Surrounding app surfaces are ivory `#f3f4ef` and near-black `#08130d`. Generated artwork has subtle tonal variation.

- `apps/mobile/assets/images/icon.png`: opaque 1024 px iOS master, square corners; `favicon.png`: opaque 48 px derivative.
- `android-icon-foreground.png`: canonical generated artwork, transparent 1024 px canvas, diagonal mark bounded to 540 px so every part fits inside the central 66% diameter adaptive safe circle. `android-icon-background.png`: opaque 1024 px field. `android-icon-monochrome.png`: white silhouette with matching alpha and placement.
- `splash-icon.png`: transparent 400 px mark for both app backgrounds.
- `public/logo192.png`, `public/logo512.png`: opaque PWA icons. `public/favicon.ico`: embedded 16/32/48 px PNG frames.
- `fairway-logo.png`: transparent 1200 × 320 horizontal lockup; emerald Avenir Next wordmark, with Avenir/Arial fallback when regenerating elsewhere.

Run `node scripts/brand/make-icons.mjs` from the repo root with workspace dependencies installed via pnpm. It uses the checked-in Android foreground as its artwork master, writes only these assets, and produces `/tmp/fairway-icon-preview.png`. To replace the artwork, pass a transparent PNG path as its first argument. No new dependencies are required. The optional SVG is omitted because the artwork is a raster original.

Artwork was created with the built-in image generation tool. Generation brief: “Single premium vector-like Fairway golf GPS symbol; transparent background; bold curving fairway seen from above, tapering toward a putting green with a chunky flag/pin; subtly suggest F through negative space; emerald #1c7a4c outer silhouette and mint #7fe0a6 inner fairway; centered, clean organic geometry, readable at 29 px; no text, tile, border, mockup, hairlines, tiny ball, shadows, texture, or photorealism.” All exports reuse that single artwork; resizing, compositing, monochrome conversion, and ICO packing are deterministic post-processing.
