/**
 * The course catalog: the fixed, reviewed course dataset every user plays.
 *
 * Curated facts (par, stroke index, lengths, tees and their ratings) live in
 * `courses/<key>.json`, each with its sources. Hole geometry is generated from
 * OpenStreetMap plus reviewed corrections into `geometry/<osmRelationId>.json` by
 * `scripts/course-data/refresh-geometry.mjs`. `courseCatalog:sync` writes both
 * into the database; the catalog always wins over database edits.
 * Process: docs/runbooks/course-catalog.md.
 */

import oosterhoutse from "./courses/oosterhoutse.json";
import oosterhoutseAcademy from "./courses/oosterhoutse-academy.json";
import welderen from "./courses/welderen.json";
import welderenPar3 from "./courses/welderen-par3.json";
import geometry901850 from "./geometry/901850.json";
import geometry4458605 from "./geometry/4458605.json";

type LatLng = { lat: number; lng: number };

export type CatalogHoleGeometry = {
	ref: string;
	holeNumber: number;
	holeLine: LatLng[];
	fairways: LatLng[][];
	greens: LatLng[][];
	bunkers: LatLng[][];
	tees: LatLng[][];
	water: LatLng[][];
	teeBoxes: { position: LatLng; colors: string[] }[];
};

export type CatalogCourse = {
	/** Stable identity across syncs and deployments. Never rename. */
	key: string;
	name: string;
	city: string;
	osmRelationId: number;
	notes: string;
	sources: string[];
	tees: {
		name: string;
		color: string;
		/** The color's name in `holes.lengths` and the geometry's `teeBoxes`. */
		marker: string;
		courseRating: number;
		slopeRating: number;
	}[];
	holes: {
		number: number;
		ref: string;
		par: number;
		strokeIndex: number;
		lengthMeters: number;
		/** The card's length per tee `marker`. */
		lengths: Record<string, number>;
	}[];
};

/** Order matters once: the first entry per OSM relation adopts a pre-catalog
 *  course row with that relation, so existing rounds keep their course. */
export const CATALOG: readonly CatalogCourse[] = [
	welderen,
	welderenPar3,
	oosterhoutse,
	oosterhoutseAcademy,
];

const GEOMETRY: Record<number, { holes: CatalogHoleGeometry[] }> = {
	901850: geometry901850,
	4458605: geometry4458605,
};

/** The OSM geometry for exactly the holes a catalog course lists. */
export function geometryFor(course: CatalogCourse): CatalogHoleGeometry[] {
	const all = GEOMETRY[course.osmRelationId]?.holes ?? [];
	return course.holes.flatMap((hole) => {
		const g = all.find((x) => x.ref === hole.ref);
		return g ? [{ ...g, holeNumber: hole.number }] : [];
	});
}
