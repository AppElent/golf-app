import { describe, expect, it } from "vitest";
import {
	collectExport,
	type ExportPage,
	type ExportStep,
	exportFileName,
	serializeExport,
} from "./data-export";

describe("collectExport", () => {
	it("walks every page and merges tables and catalog rows", async () => {
		const pages: ExportPage[] = [
			{
				tables: { rounds: [{ _id: "r1" }], holeScores: [{ _id: "s1" }] },
				catalog: { courses: [{ _id: "c1" }], tees: [{ _id: "t1" }] },
				next: { table: "rounds", cursor: "a" },
			},
			{
				tables: { rounds: [{ _id: "r2" }], holeScores: [] },
				catalog: { courses: [{ _id: "c1" }], tees: [] },
				next: { table: "clubs", cursor: null },
			},
			{ tables: { clubs: [] }, catalog: { courses: [], tees: [] }, next: null },
		];
		const steps: (ExportStep | undefined)[] = [];
		const data = await collectExport(async (step) => {
			steps.push(step);
			return pages[steps.length - 1];
		}, new Date("2026-11-18T10:00:00Z"));

		expect(steps).toEqual([
			undefined,
			{ table: "rounds", cursor: "a" },
			{ table: "clubs", cursor: null },
		]);
		expect(data).toEqual({
			format: "fairway-data-export",
			version: 1,
			exportedAt: "2026-11-18T10:00:00.000Z",
			tables: {
				rounds: [{ _id: "r1" }, { _id: "r2" }],
				holeScores: [{ _id: "s1" }],
				clubs: [],
			},
			catalog: { courses: [{ _id: "c1" }], tees: [{ _id: "t1" }] },
		});
		expect(JSON.parse(serializeExport(data))).toEqual(data);
	});

	it("gives up on a server that never finishes", async () => {
		const endless: ExportPage = {
			tables: {},
			catalog: { courses: [], tees: [] },
			next: { table: "rounds", cursor: "x" },
		};
		await expect(collectExport(async () => endless)).rejects.toThrow(
			"Export did not finish.",
		);
	});
});

it("names the file by the local date", () => {
	expect(exportFileName(new Date(2026, 0, 5, 23, 30))).toBe(
		"fairway-data-2026-01-05.json",
	);
});
