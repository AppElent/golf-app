/**
 * Draw catalog geometry over PDOK's 8 cm aerial photo, to check it by eye.
 *
 *   node scripts/course-data/inspect-hole.mjs <osmRelationId> <ref> <out.png> [--tees]
 *
 * Grid lines carry their latitude/longitude, so a position can be read straight
 * off the picture. `--tees` zooms in on the tee end of the hole, 170 m around the
 * start of its line. Hollow rings show where each tee color should be, walked
 * back along the line from the green by the card's length. Dutch courses only;
 * PDOK imagery is CC BY 4.0.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = join(import.meta.dirname, "../..");
const [id, ref, out, flag] = process.argv.slice(2);
const teeView = flag === "--tees";
if (!id || !ref || !out) {
	console.error("usage: inspect-hole.mjs <osmRelationId> <ref> <out.png> [--tees]");
	process.exit(1);
}

const { holes } = JSON.parse(
	readFileSync(join(root, `convex/catalog/geometry/${id}.json`), "utf8"),
);
const hole = holes.find((h) => h.ref === ref);
if (!hole) throw new Error(`No hole ${ref} in ${id}`);

const ZOOM = 19;
const TILE = 256;
const WORLD = TILE * 2 ** ZOOM;
const mx = (lng) => ((lng + 180) / 360) * WORLD;
const my = (lat) => {
	const s = Math.sin((lat * Math.PI) / 180);
	return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD;
};
const unx = (x) => (x / WORLD) * 360 - 180;
const uny = (y) =>
	(Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / WORLD))) * 180) / Math.PI;

const boxes = hole.teeBoxes ?? [];
const line = hole.holeLine ?? [];
const metersBetween = (a, b) =>
	Math.hypot(
		(a.lat - b.lat) * 111320,
		(a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180),
	);
const lineMeters = line.reduce(
	(sum, p, i) => (i === 0 ? 0 : sum + metersBetween(line[i - 1], p)),
	0,
);
/** `meters` from the green along the line; straight on behind the line's start. */
function walkedBack(meters) {
	let along = lineMeters - meters;
	if (along <= 0) {
		const [a, b] = line;
		const t = along / (metersBetween(a, b) || 1);
		return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
	}
	for (let i = 1; i < line.length; i++) {
		const segment = metersBetween(line[i - 1], line[i]);
		if (along <= segment) {
			const t = along / segment;
			return {
				lat: line[i - 1].lat + (line[i].lat - line[i - 1].lat) * t,
				lng: line[i - 1].lng + (line[i].lng - line[i - 1].lng) * t,
			};
		}
		along -= segment;
	}
	return line.at(-1);
}
const cardLengths = {};
for (const file of readdirSync(join(root, "convex/catalog/courses"))) {
	const course = JSON.parse(
		readFileSync(join(root, "convex/catalog/courses", file), "utf8"),
	);
	if (course.osmRelationId !== Number(id)) continue;
	const entry = course.holes.find((h) => h.ref === ref);
	if (entry?.lengths) Object.assign(cardLengths, entry.lengths);
}
const ghosts = Object.entries(cardLengths).map(([color, meters]) => ({
	color,
	meters,
	position: walkedBack(meters),
}));
const TEE_VIEW_RADIUS_M = 170;
const degLat = TEE_VIEW_RADIUS_M / 111320;
const degLng = degLat / Math.cos(((line[0]?.lat ?? 52) * Math.PI) / 180);
const points = teeView
	? [
			{ lat: line[0].lat - degLat, lng: line[0].lng - degLng },
			{ lat: line[0].lat + degLat, lng: line[0].lng + degLng },
		]
	: [
	...(hole.holeLine ?? []),
	...hole.greens.flat(),
	...hole.tees.flat(),
	...boxes.map((b) => b.position),
	...hole.bunkers.flat(),
	...hole.water.flat().filter((p) =>
		(hole.holeLine ?? []).some(
			(l) => Math.hypot((p.lat - l.lat) * 111000, (p.lng - l.lng) * 68000) < 120,
		),
	),
];
const PAD = teeView ? 0 : 180;
const x0 = Math.floor(Math.min(...points.map((p) => mx(p.lng))) - PAD);
const x1 = Math.ceil(Math.max(...points.map((p) => mx(p.lng))) + PAD);
const y0 = Math.floor(Math.min(...points.map((p) => my(p.lat))) - PAD);
const y1 = Math.ceil(Math.max(...points.map((p) => my(p.lat))) + PAD);

const tiles = [];
for (let tx = Math.floor(x0 / TILE); tx <= Math.floor(x1 / TILE); tx++) {
	for (let ty = Math.floor(y0 / TILE); ty <= Math.floor(y1 / TILE); ty++) {
		tiles.push({ tx, ty });
	}
}
const composites = [];
for (let i = 0; i < tiles.length; i += 12) {
	await Promise.all(
		tiles.slice(i, i + 12).map(async ({ tx, ty }) => {
			const res = await fetch(
				`https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/${ZOOM}/${tx}/${ty}.jpeg`,
			);
			if (!res.ok) return;
			const input = await sharp(Buffer.from(await res.arrayBuffer()))
				.png()
				.toBuffer();
			composites.push({
				input,
				left: tx * TILE - Math.floor(x0 / TILE) * TILE,
				top: ty * TILE - Math.floor(y0 / TILE) * TILE,
			});
		}),
	);
}
const originX = Math.floor(x0 / TILE) * TILE;
const originY = Math.floor(y0 / TILE) * TILE;
const canvasW =
	(Math.floor(x1 / TILE) - Math.floor(x0 / TILE) + 1) * TILE;
const canvasH =
	(Math.floor(y1 / TILE) - Math.floor(y0 / TILE) + 1) * TILE;

const px = (p) => `${(mx(p.lng) - originX).toFixed(1)},${(my(p.lat) - originY).toFixed(1)}`;
const poly = (ring, style) =>
	`<polygon points="${ring.map(px).join(" ")}" ${style}/>`;

const TEE_FILL = {
	white: "#ffffff",
	yellow: "#ffd400",
	blue: "#2f8fff",
	red: "#ff3b30",
	orange: "#ff9500",
};

const grid = [];
const STEP_LAT = teeView ? 0.0002 : 0.0005;
const STEP_LNG = teeView ? 0.0005 : 0.001;
for (let lat = Math.ceil(uny(y1) / STEP_LAT) * STEP_LAT; lat < uny(y0); lat += STEP_LAT) {
	const y = my(lat) - originY;
	grid.push(
		`<line x1="0" x2="${canvasW}" y1="${y}" y2="${y}" stroke="#fff" stroke-opacity=".35"/>`,
		`<text x="${x0 - originX + 6}" y="${y - 4}" class="g">${lat.toFixed(teeView ? 5 : 4)}</text>`,
	);
}
for (let lng = Math.ceil(unx(x0) / STEP_LNG) * STEP_LNG; lng < unx(x1); lng += STEP_LNG) {
	const x = mx(lng) - originX;
	grid.push(
		`<line y1="0" y2="${canvasH}" x1="${x}" x2="${x}" stroke="#fff" stroke-opacity=".35"/>`,
		`<text x="${x + 4}" y="${y0 - originY + 22}" class="g">${lng.toFixed(teeView ? 4 : 3)}</text>`,
	);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">
<style>.g{font:bold 20px sans-serif;fill:#fff;stroke:#000;stroke-width:4px;paint-order:stroke}.t{font:bold 24px sans-serif;fill:#fff;stroke:#000;stroke-width:5px;paint-order:stroke}</style>
${grid.join("\n")}
${hole.water.map((r) => poly(r, 'fill="#0af" fill-opacity=".35" stroke="#0af" stroke-width="3"')).join("\n")}
${hole.fairways.map((r) => poly(r, 'fill="none" stroke="#b6ff5c" stroke-width="3"')).join("\n")}
${hole.bunkers.map((r) => poly(r, 'fill="none" stroke="#ffe14d" stroke-width="4"')).join("\n")}
${hole.greens.map((r) => poly(r, 'fill="none" stroke="#00ff66" stroke-width="5"')).join("\n")}
${hole.tees.map((r) => poly(r, 'fill="none" stroke="#ff4dff" stroke-width="3"')).join("\n")}
<polyline points="${(hole.holeLine ?? []).map(px).join(" ")}" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="14 8"/>
${boxes
	.map((b) => {
		const [x, y] = px(b.position).split(",");
		return `<circle cx="${x}" cy="${y}" r="9" fill="${TEE_FILL[b.colors[0]] ?? "#f4f"}" stroke="#000" stroke-width="3"/><text x="${Number(x) + 13}" y="${Number(y) + 8}" class="t">${b.colors.join("/") || "?"}</text>`;
	})
	.join("\n")}
${ghosts
	.map((g) => {
		const [x, y] = px(g.position).split(",");
		return `<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="${TEE_FILL[g.color]}" stroke-width="4"/><text x="${Number(x) - 18}" y="${Number(y) - 18}" class="g">${g.color[0]}${g.meters}</text>`;
	})
	.join("\n")}
</svg>`;
composites.push({ input: Buffer.from(svg), left: 0, top: 0 });

const buffer = await sharp({
	create: { width: canvasW, height: canvasH, channels: 3, background: "#222" },
})
	.composite(composites)
	.png()
	.toBuffer();
const width = x1 - x0;
const height = y1 - y0;
const scale = Math.min(1, (teeView ? 1500 : 1300) / Math.max(width, height));
await sharp(buffer)
	.extract({ left: x0 - originX, top: y0 - originY, width, height })
	.resize(Math.round(width * scale), Math.round(height * scale))
	.png()
	.toFile(out);
console.log(`${out}: ${Math.round(width * scale)}x${Math.round(height * scale)}`);
