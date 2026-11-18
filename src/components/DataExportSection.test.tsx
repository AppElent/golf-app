import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/react", () => ({
	useConvex: () => ({ query: mocks.query }),
}));

import { DataExportSection } from "./DataExportSection";

const createObjectURL = vi.fn((_blob: Blob) => "blob:export");
beforeEach(() => {
	vi.clearAllMocks();
	URL.createObjectURL = createObjectURL;
	URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const button = () => screen.getByRole("button", { name: /export|preparing/i });

it("downloads every page as one JSON file", async () => {
	mocks.query
		.mockResolvedValueOnce({
			tables: { clubs: [{ _id: "c1", name: "7i" }] },
			catalog: { courses: [], tees: [] },
			next: { table: "rounds", cursor: null },
		})
		.mockResolvedValueOnce({
			tables: { rounds: [] },
			catalog: { courses: [], tees: [] },
			next: null,
		});
	const click = vi
		.spyOn(HTMLAnchorElement.prototype, "click")
		.mockImplementation(() => {});

	render(<DataExportSection />);
	await act(async () => fireEvent.click(button()));

	expect(mocks.query).toHaveBeenCalledTimes(2);
	expect(mocks.query.mock.calls[1][1]).toEqual({
		step: { table: "rounds", cursor: null },
	});
	expect(click).toHaveBeenCalledTimes(1);
	const link = click.mock.contexts[0] as HTMLAnchorElement;
	expect(link.download).toMatch(/^fairway-data-\d{4}-\d{2}-\d{2}\.json$/);
	const data = JSON.parse(await createObjectURL.mock.calls[0][0].text());
	expect(data).toMatchObject({
		format: "fairway-data-export",
		version: 1,
		tables: { clubs: [{ _id: "c1", name: "7i" }], rounds: [] },
	});
	expect(button().textContent).toBe("Export my data");
});

it("says so when the export fails", async () => {
	mocks.query.mockRejectedValue(new Error("offline"));
	render(<DataExportSection />);
	await act(async () => fireEvent.click(button()));
	expect(screen.getByRole("alert").textContent).toMatch(/couldn't export/i);
	expect(createObjectURL).not.toHaveBeenCalled();
});
