import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ConfirmPanel } from "./ConfirmPanel";

afterEach(cleanup);

function Harness({ onConfirm = () => {} }: { onConfirm?: () => void }) {
	const [open, setOpen] = useState(false);
	const trigger = useRef<HTMLButtonElement>(null);
	return open ? (
		<ConfirmPanel
			title="Delete this copy?"
			description="This can't be undone."
			confirmLabel="Delete copy"
			onConfirm={onConfirm}
			onCancel={() => setOpen(false)}
			returnFocusTo={trigger}
		/>
	) : (
		<button ref={trigger} type="button" onClick={() => setOpen(true)}>
			Delete my copy
		</button>
	);
}

it("focuses Cancel when it opens and the trigger when it closes", () => {
	render(<Harness />);
	fireEvent.click(screen.getByRole("button", { name: "Delete my copy" }));
	expect(document.activeElement).toBe(
		screen.getByRole("button", { name: "Cancel" }),
	);
	fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
	expect(document.activeElement).toBe(
		screen.getByRole("button", { name: "Delete my copy" }),
	);
});

it("names the panel by its title and describes it", () => {
	render(<Harness />);
	fireEvent.click(screen.getByRole("button", { name: "Delete my copy" }));
	const panel = screen.getByRole("region", { name: "Delete this copy?" });
	expect(panel.getAttribute("aria-describedby")).toBeTruthy();
	expect(screen.getByText("This can't be undone.")).toBeTruthy();
});

it("confirms once per press", () => {
	const onConfirm = vi.fn();
	render(<Harness onConfirm={onConfirm} />);
	fireEvent.click(screen.getByRole("button", { name: "Delete my copy" }));
	fireEvent.click(screen.getByRole("button", { name: "Delete copy" }));
	expect(onConfirm).toHaveBeenCalledOnce();
});

it("asks a question with choices and no confirm button", () => {
	render(
		<ConfirmPanel title="What do you want to delete?" onCancel={() => {}}>
			<button type="button">Delete Fairway data only</button>
		</ConfirmPanel>,
	);
	expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
		"Delete Fairway data only",
		"Cancel",
	]);
});

it("shows a failure as an alert", () => {
	render(
		<ConfirmPanel
			title="Delete this copy?"
			confirmLabel="Delete copy"
			onConfirm={() => {}}
			onCancel={() => {}}
			error="Finish or abandon the round you're playing on this copy first."
		/>,
	);
	expect(screen.getByRole("alert").textContent).toMatch(/finish or abandon/i);
});
