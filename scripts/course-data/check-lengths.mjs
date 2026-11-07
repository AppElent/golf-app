/**
 * Compare each tee color's mapped route with the scorecard length, per hole.
 *
 *   node scripts/course-data/check-lengths.mjs [osmRelationId]
 *
 * A hole line that stops short or a tee box in the wrong place shows up here as a
 * residual. convex/catalog/catalog.test.ts enforces the same limit.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	polygonCentroid,
	polylineLength,
	routeMeters,
} from "../../packages/core/src/geo.ts";

const root = join(import.meta.dirname, "../..");
const only = process.argv[2] ? Number(process.argv[2]) : null;
const coursesDir = join(root, "convex/catalog/courses");

for (const file of readdirSync(coursesDir)) {
	const course = JSON.parse(readFileSync(join(coursesDir, file), "utf8"));
	if (only && course.osmRelationId !== only) continue;
	const { holes } = JSON.parse(
		readFileSync(
			join(root, `convex/catalog/geometry/${course.osmRelationId}.json`),
			"utf8",
		),
	);
	const markers = [...new Set(course.tees.map((tee) => tee.marker))];
	console.log(`\n${file}`);
	for (const hole of course.holes) {
		const geo = holes.find((h) => h.ref === hole.ref);
		const green = geo.greens[0]
			? polygonCentroid(geo.greens[0])
			: geo.holeLine.at(-1);
		const cells = markers.map((marker) => {
			const box = geo.teeBoxes.find((b) => b.colors.includes(marker));
			const card = hole.lengths[marker];
			if (!box) return `${marker[0]} --/${card}`;
			const route = Math.round(routeMeters(box.position, geo.holeLine, green));
			return `${marker[0]} ${route}/${card} (${route - card})`;
		});
		console.log(
			hole.ref.padEnd(4),
			`line ${Math.round(polylineLength(geo.holeLine))}`.padEnd(9),
			cells.join("  "),
		);
	}
}
