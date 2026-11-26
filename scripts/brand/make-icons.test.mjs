// @vitest-environment node
// make-icons.mjs must reproduce the committed brand assets on any machine
// (APP-531): it reads text from committed masks, never from system fonts.
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
let out;

beforeAll(async () => {
  out = await mkdtemp(path.join(tmpdir(), "fairway-icons-"));
  execFileSync(process.execPath, [path.join(root, "scripts/brand/make-icons.mjs"), out]);
}, 120_000);
afterAll(() => rm(out, { recursive: true, force: true }));

// Largest difference in alpha and in alpha-weighted colour (0-255), so the
// colour of a fully transparent pixel does not count.
async function difference(a, b) {
  const [x, y] = await Promise.all([a, b].map((file) => sharp(file).ensureAlpha().raw().toBuffer()));
  expect(x.length).toBe(y.length);
  let alpha = 0;
  let colour = 0;
  for (let i = 0; i < x.length; i += 4) {
    alpha = Math.max(alpha, Math.abs(x[i + 3] - y[i + 3]));
    for (let c = 0; c < 3; c++) {
      colour = Math.max(colour, Math.abs(x[i + c] * x[i + 3] - y[i + c] * y[i + 3]) / 255);
    }
  }
  return { alpha, colour };
}

describe("make-icons.mjs", () => {
  it("regenerates every committed PNG asset unchanged", async () => {
    const files = (await readdir(out, { recursive: true })).filter((file) => file.endsWith(".png"));
    expect(files).toEqual(expect.arrayContaining([
      "apps/mobile/assets/images/icon-dev.png",
      "apps/mobile/assets/images/android-icon-foreground-preview.png",
      "docs/brand/fairway-logo.png",
      "public/fairway-logo-dark.png",
    ]));
    for (const file of files) {
      // A rounding step of libvips may differ between CPUs; a font change
      // moves whole glyph edges (differences above 100).
      const { alpha, colour } = await difference(path.join(out, file), path.join(root, file));
      expect({ file, alpha: alpha <= 3, colour: colour <= 3 }).toEqual({ file, alpha: true, colour: true });
    }
  }, 120_000);
});
