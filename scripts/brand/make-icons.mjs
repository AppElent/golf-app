import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../../", import.meta.url));

// Masters live in docs/brand/icon/: light.png is the generated artwork; dark,
// tinted and the transparent mark come from scripts/brand/derive-appearances.py.
const brand = (name) => readFile(path.join(root, `docs/brand/icon/${name}.png`));
const field = ["#1cb45d", "#013a27"];
const mobile = "apps/mobile/assets/images/";
const svg = (width, height, content) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`,
);
const save = (name, buffer) => writeFile(path.join(root, name), buffer);
const clear = (width, height) => sharp({
  create: { width, height, channels: 4, background: "#00000000" },
});

// iOS: one opaque 1024 px icon per appearance (App Store icons carry no alpha).
const master = async (appearance) =>
  sharp(await brand(appearance)).resize(1024, 1024).removeAlpha().png().toBuffer();
const icon = await master("light");
await save(`${mobile}icon.png`, icon);
for (const appearance of ["dark", "tinted"]) {
  await save(`${mobile}icon-${appearance}.png`, await master(appearance));
}

// The mark alone, trimmed to its bounding box, for the transparent assets.
const onLayer = await sharp(await brand("mark")).trim({ threshold: 1 }).png().toBuffer();
const onSurface = onLayer;
async function mark(canvas, extent, master = onLayer) {
  const image = await sharp(master).resize(extent, extent, { fit: "inside" }).png().toBuffer();
  return clear(canvas, canvas).composite([{ input: image, gravity: "centre" }]).png().toBuffer();
}

// Android (parked, regenerated for consistency): the hole fits in a
// 540 px box, inside the adaptive icon's central 66% safe circle.
const adaptive = await mark(1024, 540);
await save(`${mobile}android-icon-foreground.png`, adaptive);
const background = await sharp(svg(1024, 1024, `
  <defs><linearGradient id="field" x2="0.85" y2="1">
    <stop stop-color="${field[0]}"/><stop offset="1" stop-color="${field[1]}"/>
  </linearGradient></defs><rect width="1024" height="1024" fill="url(#field)"/>`))
  .removeAlpha().png().toBuffer();
await save(`${mobile}android-icon-background.png`, background);
const alpha = await sharp(adaptive).extractChannel("alpha").toBuffer();
const mono = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "white" } })
  .joinChannel(alpha).png().toBuffer();
await save(`${mobile}android-icon-monochrome.png`, mono);
const splash = await mark(400, 360, onSurface);
await save(`${mobile}splash-icon.png`, splash);
for (const size of [192, 512]) {
  await save(`public/logo${size}.png`, await sharp(icon).resize(size).png().toBuffer());
}

// Install-variant badges: a band along the bottom of the iOS icon, a pill
// inside the safe circle of the Android foreground.
const badges = { dev: ["DEV", "#ff8a3d"], test: ["TEST", "#c9a7ff"], preview: ["PREVIEW", "#6aa9ff"] };
const label = (x, y, size, text) =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${size}" fill="#111111">${text}</text>`;
for (const [variant, [text, color]] of Object.entries(badges)) {
  const band = svg(1024, 1024, `<rect y="830" width="1024" height="194" fill="${color}"/>${label(512, 975, 130, text)}`);
  await save(`${mobile}icon-${variant}.png`,
    await sharp(icon).composite([{ input: band }]).removeAlpha().png().toBuffer());
  const pill = 70 + text.length * 30;
  const badge = svg(1024, 1024,
    `<rect x="${512 - pill / 2}" y="770" width="${pill}" height="64" rx="32" fill="${color}"/>${label(512, 817, 44, text)}`);
  await save(`${mobile}android-icon-foreground-${variant}.png`,
    await sharp(adaptive).composite([{ input: badge }]).png().toBuffer());
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
// The dark lockup (mint wordmark, `--color-pine-ink` in dark) is the sign-in
// card's logo in dark mode (src/integrations/clerk/appearance.ts).
const wordmarkSvg = (fill) => svg(900, 280, `<text x="0" y="195" font-family="Avenir Next, Avenir, Arial, sans-serif" font-weight="600" font-size="188" letter-spacing="-7" fill="${fill}">Fairway</text>`);
const lockup = async (fill) => clear(1200, 320).composite([
  { input: await mark(280, 252, onSurface), left: 0, top: 20 },
  { input: wordmarkSvg(fill), left: 300, top: 20 },
]).png().toBuffer();
await save("docs/brand/fairway-logo.png", await lockup("#1c7a4c"));
await save("public/fairway-logo-dark.png", await lockup("#7fe0a6"));

// Contact sheet: each iOS appearance, small sizes and the Android layers.
const width = 2220;
const height = 1480;
const texts = [];
const layers = [];
const text = (x, y, value, color = "#08130d", size = 22) => texts.push(
  `<text x="${x}" y="${y}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}">${value}</text>`,
);
const rounded = async (buffer, size) => sharp(await sharp(buffer).resize(size).png().toBuffer())
  .composite([{ input: svg(size, size, `<rect width="${size}" height="${size}" rx="${size * 0.2237}" fill="white"/>`), blend: "dest-in" }])
  .png().toBuffer();
const appearances = [["light", icon], ["dark", await readFile(path.join(root, `${mobile}icon-dark.png`))],
  ["tinted", await readFile(path.join(root, `${mobile}icon-tinted.png`))]];
for (const [i, [name, buffer]] of appearances.entries()) {
  layers.push({ input: await rounded(buffer, 600), left: 60 + i * 720, top: 90 });
  text(60 + i * 720, 60, `iOS ${name} · 1024 × 1024`, "#1c7a4c", 26);
}
for (const [i, size] of [180, 60, 29].entries()) {
  layers.push({ input: await rounded(icon, size), left: 60 + i * 230, top: 1000 });
  text(60 + i * 230, 1230, `${size} px`);
}
const adaptiveIcon = await sharp(background).composite([{ input: adaptive }]).png().toBuffer();
const circle = await sharp(adaptiveIcon).resize(220).png().toBuffer();
layers.push({ input: await sharp(circle).composite([{ input: svg(220, 220, '<circle cx="110" cy="110" r="110" fill="white"/>'), blend: "dest-in" }]).png().toBuffer(), left: 780, top: 1000 });
text(780, 1260, "Android adaptive");
layers.push({ input: await sharp(splash).resize(160).png().toBuffer(), left: 1080, top: 1030 });
text(1080, 1260, "Splash mark");
const logo = await readFile(path.join(root, "docs/brand/fairway-logo.png"));
layers.push({ input: await sharp(logo).resize(720).png().toBuffer(), left: 1360, top: 1040 });
text(1360, 1260, "Horizontal lockup");
await sharp(svg(width, height, '<rect width="2220" height="1480" fill="#f3f4ef"/>')).composite([
  ...layers,
  { input: svg(width, height, texts.join("")) },
]).png().toFile("/tmp/fairway-icon-preview.png");
console.log("Wrote Fairway brand assets and /tmp/fairway-icon-preview.png");
