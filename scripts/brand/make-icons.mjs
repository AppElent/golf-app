import { createRequire } from "node:module";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  const store = path.join(root, "node_modules/.pnpm");
  const entry = (await readdir(store)).find((name) => name.startsWith("sharp@"));
  if (!entry) throw new Error("Install the workspace dependencies with pnpm first.");
  sharp = require(path.join(store, entry, "node_modules/sharp"));
}

const mobile = "apps/mobile/assets/images/";
const foreground = `${mobile}android-icon-foreground.png`;
const source = process.argv[2] || path.join(root, foreground);
const svg = (width, height, content) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`,
);
const save = (name, buffer) => writeFile(path.join(root, name), buffer);
const clear = (width, height) => sharp({
  create: { width, height, channels: 4, background: "#00000000" },
});

// The checked-in adaptive foreground is the canonical imagegen artwork.
// Passing another transparent source explicitly replaces that master.
const sourcePixels = await sharp(await readFile(source)).ensureAlpha().raw()
  .toBuffer({ resolveWithObject: true });
// Remove near-invisible generation residue outside the solid silhouette.
for (let i = 3; i < sourcePixels.data.length; i += 4) {
  if (sourcePixels.data[i] <= 4) sourcePixels.data[i] = 0;
}
const master = await sharp(sourcePixels.data, { raw: sourcePixels.info })
  .trim().png().toBuffer();
async function mark(canvas, extent) {
  const image = await sharp(master).resize(extent, extent, { fit: "inside" }).png().toBuffer();
  return clear(canvas, canvas).composite([{ input: image, gravity: "centre" }]).png().toBuffer();
}
// The diagonal silhouette needs a 540 px bounding box to fit wholly within
// Android's central 66% diameter safe circle, including the raised flag.
const adaptive = await mark(1024, 540);
await save(foreground, adaptive);
const background = await sharp(svg(1024, 1024, `
  <defs><linearGradient id="field" x2="0.85" y2="1">
    <stop stop-color="#2e9e63"/><stop offset="1" stop-color="#0f5c33"/>
  </linearGradient></defs><rect width="1024" height="1024" fill="url(#field)"/>`))
  .removeAlpha().png().toBuffer();
await save(`${mobile}android-icon-background.png`, background);
const icon = await sharp(background).composite([{ input: await mark(1024, 766) }])
  .removeAlpha().png().toBuffer();
await save(`${mobile}icon.png`, icon);
const alpha = await sharp(adaptive).extractChannel("alpha").toBuffer();
const mono = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "white" } })
  .joinChannel(alpha).png().toBuffer();
await save(`${mobile}android-icon-monochrome.png`, mono);
const splash = await mark(400, 360);
await save(`${mobile}splash-icon.png`, splash);
await save(`${mobile}favicon.png`, await sharp(icon).resize(48).png().toBuffer());
for (const size of [192, 512]) {
  await save(`public/logo${size}.png`, await sharp(icon).resize(size).png().toBuffer());
}

// ICO directory with PNG-compressed 16/32/48 frames, supported by modern browsers.
const frames = await Promise.all([16, 32, 48].map((size) => sharp(icon).resize(size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * frames.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, i) => {
  const start = 6 + i * 16;
  header[start] = header[start + 1] = [16, 32, 48][i];
  header.writeUInt16LE(1, start + 4);
  header.writeUInt16LE(32, start + 6);
  header.writeUInt32LE(frame.length, start + 8);
  header.writeUInt32LE(offset, start + 12);
  offset += frame.length;
});
await save("public/favicon.ico", Buffer.concat([header, ...frames]));

// Avenir Next is shipped on macOS; portable sans-serif fallbacks remain usable.
const wordmark = svg(900, 280, `<text x="0" y="195" font-family="Avenir Next, Avenir, Arial, sans-serif" font-weight="600" font-size="188" letter-spacing="-7" fill="#1c7a4c">Fairway</text>`);
await save("docs/brand/fairway-logo.png", await clear(1200, 320).composite([
  { input: await mark(280, 252), left: 0, top: 20 },
  { input: wordmark, left: 300, top: 20 },
]).png().toBuffer());

// Contact sheet: every icon size appears on both backgrounds at native resolution.
const width = 2220;
const height = 1820;
const labels = [];
const layers = [];
const text = (x, y, value, color = "#08130d", size = 20) => labels.push(
  `<text x="${x}" y="${y}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}">${value}</text>`,
);
const rects = [
  '<rect width="2220" height="1820" fill="#f3f4ef"/>',
  '<rect x="1110" width="1110" height="1820" fill="#08130d"/>',
];
for (const [origin, ink] of [[0, "#1c7a4c"], [1110, "#7fe0a6"]]) {
  text(origin + 38, 45, "FAIRWAY / MASTER ICON · 1024 × 1024", ink, 23);
  layers.push({ input: icon, left: origin + 38, top: 75 });
  for (const [size, x] of [[180, 38], [60, 265], [29, 382]]) {
    layers.push({ input: await sharp(icon).resize(size).png().toBuffer(), left: origin + x, top: 1160 });
    text(origin + x, 1380, `${size} px`, ink);
  }
  layers.push({ input: await sharp(splash).resize(76).png().toBuffer(), left: origin + 640, top: 1180 });
  text(origin + 580, 1320, "Splash / 76 pt", ink);
}
const adaptiveIcon = await sharp(background).composite([{ input: adaptive }]).png().toBuffer();
const circle = await sharp(adaptiveIcon).resize(280).png().toBuffer();
const circleMask = svg(280, 280, '<circle cx="140" cy="140" r="140" fill="white"/>');
layers.push({ input: await sharp(circle).composite([{ input: circleMask, blend: "dest-in" }]).png().toBuffer(), left: 1148, top: 1450 });
text(1148, 1780, "Android adaptive / circle", "#f3f4ef");
layers.push({ input: await sharp(mono).resize(280).png().toBuffer(), left: 1560, top: 1450 });
text(1560, 1780, "Android themed / monochrome", "#f3f4ef");
const logo = await readFile(path.join(root, "docs/brand/fairway-logo.png"));
layers.push({ input: await sharp(logo).resize(960).png().toBuffer(), left: 38, top: 1460 });
text(38, 1780, "Horizontal lockup / transparent", "#1c7a4c");
await sharp(svg(width, height, rects.join(""))).composite([
  ...layers,
  { input: svg(width, height, labels.join("")) },
]).png().toFile("/tmp/fairway-icon-preview.png");
console.log("Wrote Fairway brand assets and /tmp/fairway-icon-preview.png");
