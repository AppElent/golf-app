/**
 * "Export my data" (features.ts `data-export`): the file web and mobile hand
 * the user. Convex serves the user's rows in bounded pages
 * (`account.exportPage`); `collectExport` walks them and builds the file, so
 * both apps write the same format.
 */

/** The `format` field, so a reader can tell the file is a Fairway export. */
export const EXPORT_FORMAT = "fairway-data-export";

/** Bumped when a reader of an older file would misread a newer one. */
export const EXPORT_VERSION = 1;

/** Where the next page starts: a table and its pagination cursor. */
export interface ExportStep {
	table: string;
	cursor: string | null;
}

/** A shared catalog row a user's row refers to (a round's course or tee). */
export interface CatalogRef {
	_id: string;
}

/** One page from `account.exportPage`. */
export interface ExportPage {
	/** Rows per table; a page lists every table it covers, empty or not. */
	tables: Record<string, readonly unknown[]>;
	/** Catalog courses and tees the page's rows name, so the file reads on its own. */
	catalog: { courses: readonly CatalogRef[]; tees: readonly CatalogRef[] };
	next: ExportStep | null;
}

export interface DataExport {
	format: typeof EXPORT_FORMAT;
	version: typeof EXPORT_VERSION;
	/** ISO 8601. */
	exportedAt: string;
	/** Every user-owned table, keyed by its Convex table name. */
	tables: Record<string, unknown[]>;
	/** Shared catalog rows referred to above; not the user's data. */
	catalog: { courses: CatalogRef[]; tees: CatalogRef[] };
}

/** Far above any real account; stops a server that never says done. */
const MAX_PAGES = 10_000;

/** Fetches every page, from the first (`undefined`) until `next` is null. */
export async function collectExport(
	fetchPage: (step: ExportStep | undefined) => Promise<ExportPage>,
	now: Date = new Date(),
): Promise<DataExport> {
	const tables: Record<string, unknown[]> = {};
	const courses = new Map<string, CatalogRef>();
	const tees = new Map<string, CatalogRef>();
	let step: ExportStep | undefined;
	for (let pages = 0; ; pages++) {
		if (pages === MAX_PAGES) throw new Error("Export did not finish.");
		const page = await fetchPage(step);
		for (const [table, rows] of Object.entries(page.tables)) {
			tables[table] ??= [];
			tables[table].push(...rows);
		}
		for (const c of page.catalog.courses) courses.set(c._id, c);
		for (const t of page.catalog.tees) tees.set(t._id, t);
		if (!page.next) break;
		step = page.next;
	}
	return {
		format: EXPORT_FORMAT,
		version: EXPORT_VERSION,
		exportedAt: now.toISOString(),
		tables,
		catalog: { courses: [...courses.values()], tees: [...tees.values()] },
	};
}

/** Indented, so the file is readable as is. */
export function serializeExport(data: DataExport): string {
	return JSON.stringify(data, null, 2);
}

/** `fairway-data-2026-11-18.json`, in the user's local date. */
export function exportFileName(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `fairway-data-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
