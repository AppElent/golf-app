import fs from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	isLargeScreenRoute,
	LARGE_SCREEN_ROUTE_FILES,
	routeFileOf,
} from "./large-screen";
import { Page } from "./Page";

const routeIds: string[] = [];
vi.mock("@tanstack/react-router", () => ({
	useRouterState: ({
		select,
	}: {
		select: (state: { matches: { routeId: string }[] }) => unknown;
	}) => select({ matches: routeIds.map((routeId) => ({ routeId })) }),
}));

afterEach(() => {
	cleanup();
	routeIds.length = 0;
});

const routesDir = path.resolve(import.meta.dirname, "../routes");

/** Each flat route file with the id its `createFileRoute(...)` call declares. */
const routeFiles = fs
	.readdirSync(routesDir)
	.filter((name) => /\.tsx$/.test(name) && !name.startsWith("__"))
	.map((name) => {
		const source = fs.readFileSync(path.join(routesDir, name), "utf8");
		const id = source.match(/createFileRoute\("([^"]+)"\)/)?.[1];
		return { file: name.replace(/\.tsx$/, ""), id };
	});

describe("large-screen routes", () => {
	it("are the course authoring routes from features.ts", () => {
		expect([...LARGE_SCREEN_ROUTE_FILES].sort()).toEqual([
			"courses.$courseId.edit",
			"courses.index",
		]);
	});

	it("are listed without globs, so an exact match finds them", () => {
		for (const file of LARGE_SCREEN_ROUTE_FILES) {
			expect(file).not.toContain("*");
		}
	});

	it("map every route id back to its route file", () => {
		expect(routeFiles.length).toBeGreaterThan(5);
		for (const { file, id } of routeFiles) {
			expect(id, file).toBeDefined();
			expect(routeFileOf(id as string)).toBe(file);
		}
	});

	it("leave every other page in the phone column", () => {
		const wide = routeFiles
			.filter(({ id }) => isLargeScreenRoute(id as string))
			.map(({ id }) => id);
		expect(wide.sort()).toEqual(["/courses/", "/courses/$courseId/edit"]);
		expect(isLargeScreenRoute("__root__")).toBe(false);
	});
});

describe("Page", () => {
	it("widens and carries the notice on a large-screen route", () => {
		routeIds.push("__root__", "/courses/$courseId/edit");
		render(<Page>Editor</Page>);
		expect(screen.getByRole("note").textContent).toContain(
			"Best on a larger screen.",
		);
		expect(screen.getByRole("main").className).toContain("max-w-6xl");
	});

	it("stays as it was on other routes", () => {
		routeIds.push("__root__", "/play");
		render(<Page>Play</Page>);
		expect(screen.queryByRole("note")).toBeNull();
		expect(screen.getByRole("main").className).toBe("px-5 pt-16 pb-[110px]");
	});
});
