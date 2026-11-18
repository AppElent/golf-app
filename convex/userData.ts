import type { DataModel, Doc, Id, TableNames } from "./_generated/dataModel";

/**
 * What every table holds for one user: the registry data export walks
 * (convex standard, "Account deletion and export"). Typed by every table in
 * the schema, so a new table fails typecheck until it states its treatment,
 * and `functions.test.ts` fails until the export returns its rows.
 */

type IndexOf<T extends TableNames> = keyof DataModel[T]["indexes"] & string;

/** The first field of index `I`: the value the export reads it by. */
type LeadField<
	T extends TableNames,
	I extends IndexOf<T>,
> = DataModel[T]["indexes"][I] extends readonly [infer F, ...unknown[]]
	? F
	: never;

/** Catalog rows a user's row names, exported by name so the file reads on its own. */
export interface CatalogIds {
	courses?: readonly (Id<"courses"> | undefined)[];
	tees?: readonly (Id<"tees"> | undefined)[];
}

/** Rows the user owns: read by an index on their user id, `pageSize` per page. */
export type Owned<T extends TableNames> = {
	[I in IndexOf<T>]: {
		kind: "owned";
		index: I;
		/** Holds the caller's auth subject; left out of the file. */
		field: LeadField<T, I>;
		pageSize: number;
		references?: (doc: Doc<T>) => CatalogIds;
	};
}[IndexOf<T>];

/** Rows of an owned row: read by an index on the parent's id, page by page with the parent. */
export type Child<T extends TableNames> = {
	[I in IndexOf<T>]: {
		kind: "child";
		parent: TableNames;
		index: I;
		field: LeadField<T, I>;
	};
}[IndexOf<T>];

export type Treatment<T extends TableNames> =
	| Owned<T>
	| Child<T>
	| { kind: "shared"; reason: string };

export const USER_DATA: { [T in TableNames]: Treatment<T> } = {
	userSettings: {
		kind: "owned",
		index: "by_user",
		field: "userId",
		pageSize: 100,
		references: (s) => ({ courses: [s.homeCourseId] }),
	},
	clubs: { kind: "owned", index: "by_user", field: "userId", pageSize: 200 },
	// 20 rounds of up to 36 holes for 4 players stay far below the read limits.
	rounds: {
		kind: "owned",
		index: "by_user",
		field: "userId",
		pageSize: 20,
		references: (r) => ({ courses: [r.courseId], tees: [r.teeId] }),
	},
	holeScores: {
		kind: "child",
		parent: "rounds",
		index: "by_round",
		field: "roundId",
	},
	shots: { kind: "owned", index: "by_user", field: "userId", pageSize: 500 },
	courseSuggestions: {
		kind: "owned",
		index: "by_user",
		field: "userId",
		pageSize: 200,
		references: (s) => ({ courses: [s.courseId] }),
	},
	// The user's own course copies. Catalog courses have no ownerId, so this
	// index never returns them. One copy per page: with all its hole geometry
	// a course is about 300 kB.
	courses: {
		kind: "owned",
		index: "by_owner",
		field: "ownerId",
		pageSize: 1,
		references: (c) => ({ courses: [c.forkedFrom] }),
	},
	tees: {
		kind: "child",
		parent: "courses",
		index: "by_course",
		field: "courseId",
	},
	holes: {
		kind: "child",
		parent: "courses",
		index: "by_course",
		field: "courseId",
	},
	holeGeometry: {
		kind: "child",
		parent: "courses",
		index: "by_course",
		field: "courseId",
	},
};

/** Tables read by the user's id, in export order. */
export const OWNED_TABLES = (Object.keys(USER_DATA) as TableNames[]).filter(
	(table) => USER_DATA[table].kind === "owned",
);

/** The tables read under `parent`, page by page with it. */
export function childTables(parent: TableNames): TableNames[] {
	return (Object.keys(USER_DATA) as TableNames[]).filter((table) => {
		const treatment = USER_DATA[table];
		return treatment.kind === "child" && treatment.parent === parent;
	});
}
