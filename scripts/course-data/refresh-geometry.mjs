/**
 * Refresh the catalog's hole geometry from OpenStreetMap.
 *
 *   node scripts/course-data/refresh-geometry.mjs [osmRelationId…] [--raw <dir>]
 *
 * Reads the OSM relations named by convex/catalog/courses/*.json (or the ids
 * given), fetches their golf features and water from Overpass, normalizes them
 * with packages/core/src/osm.ts, applies scripts/course-data/overrides/<id>.json
 * and writes convex/catalog/geometry/<id>.json. Only geometry comes from OSM:
 * par, stroke index, lengths and tees are curated by hand in the course files.
 * Commit the result, then sync the catalog (docs/runbooks/course-catalog.md).
 * Runs on a developer machine — never from Convex, whose deploy-time network
 * can't be relied on to reach Overpass. `--raw <dir>` saves each Overpass answer
 * as <dir>/osm-<id>.json and reuses it on later runs, to iterate on overrides
 * without hitting Overpass.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeCourse } from "../../packages/core/src/osm.ts";

const root = join(import.meta.dirname, "../..");
const coursesDir = join(root, "convex/catalog/courses");
const geometryDir = join(root, "convex/catalog/geometry");
const overridesDir = join(root, "scripts/course-data/overrides");

const args = process.argv.slice(2);
const rawFlag = args.indexOf("--raw");
const rawDir = rawFlag >= 0 ? args[rawFlag + 1] : null;
const fromArgs = args
	.filter((_, i) => rawFlag < 0 || (i !== rawFlag && i !== rawFlag + 1))
	.map(Number)
	.filter(Number.isFinite);
const ids =
	fromArgs.length > 0
		? fromArgs
		: [
				...new Set(
					readdirSync(coursesDir)
						.filter((f) => f.endsWith(".json"))
						.map(
							(f) =>
								JSON.parse(readFileSync(join(coursesDir, f), "utf8"))
									.osmRelationId,
						),
				),
			];

/** ~10 cm precision keeps the files small without moving anything visibly. */
const round = (value) =>
	Array.isArray(value)
		? value.map(round)
		: value && typeof value === "object"
			? Object.fromEntries(
					Object.entries(value).map(([k, v]) => [
						k,
						typeof v === "number" && (k === "lat" || k === "lng")
							? Math.round(v * 1e6) / 1e6
							: round(v),
					]),
				)
			: value;

/** Overpass sheds load with 429/502/504; back off and retry a few times. */
async function overpass(query, attempt = 1) {
	const res = await fetch("https://overpass-api.de/api/interpreter", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"User-Agent": "fairway-course-data/1.0 (github.com/AppElent/golf-app)",
		},
		body: `data=${encodeURIComponent(query)}`,
	});
	if (res.ok) return await res.json();
	if (attempt >= 5 || ![429, 502, 503, 504].includes(res.status)) {
		throw new Error(`Overpass: HTTP ${res.status}`);
	}
	await new Promise((r) => setTimeout(r, attempt * 5000));
	return overpass(query, attempt + 1);
}

/** Plain `out geom`: `out geom tags` would drop the members of multipolygons. */
async function fetchElements(id) {
	const rawFile = rawDir ? join(rawDir, `osm-${id}.json`) : null;
	if (rawFile && existsSync(rawFile)) {
		return JSON.parse(readFileSync(rawFile, "utf8")).elements;
	}
	const query = `[out:json][timeout:90];rel(${id});map_to_area->.a;(way(area.a)[golf];rel(area.a)[golf];node(area.a)[golf=pin];node(area.a)[golf=tee];way(area.a)[natural=water];rel(area.a)[natural=water];way(area.a)[waterway];);out geom;`;
	const answer = await overpass(query);
	if (rawFile) writeFileSync(rawFile, JSON.stringify(answer));
	return answer.elements;
}

for (const id of ids) {
	const elements = await fetchElements(id);
	const overridesFile = join(overridesDir, `${id}.json`);
	const overrides = existsSync(overridesFile)
		? JSON.parse(readFileSync(overridesFile, "utf8")).holes
		: {};
	const { geometry } = normalizeCourse(elements, overrides);
	const sorted = round(
		[...geometry].sort((a, b) => a.ref.localeCompare(b.ref, "en", { numeric: true })),
	);
	writeFileSync(
		join(geometryDir, `${id}.json`),
		`${JSON.stringify({ osmRelationId: id, fetchedAt: new Date().toISOString().slice(0, 10), holes: sorted })}\n`,
	);
	console.log(`${id}: ${sorted.length} holes`);
}
