// The brand's text, drawn as SVG. Only make-text-masks.mjs renders these: SVG
// text takes whatever fonts the machine has, so the rendered alpha masks are
// committed in docs/brand/text/ and make-icons.mjs reads those instead.
export const svg = (width, height, content) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`,
);

// Install-variant badges: a band along the bottom of the iOS icon, a pill
// inside the safe circle of the Android foreground.
export const badges = { dev: ["DEV", "#ff8a3d"], test: ["TEST", "#c9a7ff"], preview: ["PREVIEW", "#6aa9ff"] };
export const pillWidth = (text) => 70 + text.length * 30;
const label = (x, y, size, text) =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${size}" fill="white">${text}</text>`;

export const texts = {
  // Avenir Next ships on macOS; the masks were rendered there.
  wordmark: svg(900, 280, `<text x="0" y="195" font-family="Avenir Next, Avenir, Arial, sans-serif" font-weight="600" font-size="188" letter-spacing="-7" fill="white">Fairway</text>`),
  ...Object.fromEntries(Object.entries(badges).flatMap(([variant, [text]]) => [
    [`ios-${variant}`, svg(1024, 1024, label(512, 975, 130, text))],
    [`android-${variant}`, svg(1024, 1024, label(512, 817, 44, text))],
  ])),
};
