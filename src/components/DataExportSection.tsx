import {
	collectExport,
	exportFileName,
	serializeExport,
} from "@fairway/core/data-export";
import { useConvex } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { CONTROL } from "./classes";
import { Section } from "./Page";

/** "Export my data" (features.ts `data-export`): downloads everything Convex
 *  holds for the signed-in user as one JSON file. */
export function DataExportSection() {
	const convex = useConvex();
	const [exporting, setExporting] = useState(false);
	const [failed, setFailed] = useState(false);

	async function onExport() {
		setExporting(true);
		setFailed(false);
		try {
			const now = new Date();
			const data = await collectExport(
				(step) => convex.query(api.account.exportPage, { step }),
				now,
			);
			download(serializeExport(data), exportFileName(now));
		} catch {
			setFailed(true);
		} finally {
			setExporting(false);
		}
	}

	return (
		<Section
			title="Your data"
			hint="One JSON file with your rounds, scores, shots, clubs, settings, course copies and suggestions."
		>
			<button
				type="button"
				disabled={exporting}
				onClick={onExport}
				className={`w-full rounded-xl border ${CONTROL} px-4 py-3 font-display text-callout font-semibold text-ink disabled:opacity-40`}
			>
				{exporting ? "Preparing export…" : "Export my data"}
			</button>
			{failed ? (
				<p role="alert" className="mt-2 text-label font-semibold text-flag-ink">
					Couldn't export your data. Check your connection and try again.
				</p>
			) : null}
		</Section>
	);
}

function download(text: string, fileName: string) {
	const url = URL.createObjectURL(
		new Blob([text], { type: "application/json" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
	// Some browsers start reading the file after click() returns.
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
