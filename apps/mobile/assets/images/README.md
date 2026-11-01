# App icons

- `icon.png`: 1024 × 1024 opaque iOS and general Expo icon.
- `android-icon-*.png`: Android adaptive icon layers. The foreground keeps the
  subject inside the central 66% circle.
- `icon-dev.png`, `icon-preview.png`, `android-icon-foreground-dev.png`,
  `android-icon-foreground-preview.png`: the same art with an orange DEV or
  blue PREVIEW label (the Foundry convention), picked per
  [install variant](../../app.config.ts). The iOS label is a band along the
  bottom; the Android label is a pill inside the safe circle.

The badged files were composited from the originals with sharp (an SVG band or
pill over the art); regenerate them if the base icon changes. A launcher icon
changes only with a rebuild, not an OTA update.
