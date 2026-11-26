// Renders the brand's text to alpha masks in docs/brand/text/. The output
// depends on the machine's fonts, so run it only when the text changes, on a
// Mac (Avenir Next), and commit the masks; make-icons.mjs uses no fonts.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { texts } from "./text.mjs";

const dir = fileURLToPath(new URL("../../docs/brand/text/", import.meta.url));
await mkdir(dir, { recursive: true });
for (const [name, source] of Object.entries(texts)) {
  const mask = await sharp(source).ensureAlpha().extractChannel("alpha").png().toBuffer();
  await writeFile(path.join(dir, `${name}.png`), mask);
}
console.log(`Wrote ${Object.keys(texts).length} text masks to docs/brand/text/`);
