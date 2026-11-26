import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { type Locale, LocaleProvider } from "../../../i18n";
import {
	PREFERENCE_KEYS,
	writePreference,
} from "../../../prefs/local-preference";
import { AppearanceProvider } from "../../../theme";
import { FlightRow } from "./flight-row";
import type { ScoreDraft } from "./score-model";

const empty: ScoreDraft = {
	strokes: null,
	putts: null,
	fir: null,
	firMiss: null,
	bunker: false,
	penalties: 0,
	nr: false,
};

function Row() {
	const [draft, setDraft] = useState(empty);
	return (
		<FlightRow
			name="Piet"
			par={4}
			draft={draft}
			detail=""
			onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
		/>
	);
}

async function renderIn(locale: Locale) {
	writePreference(PREFERENCE_KEYS.locale, locale);
	await render(
		<AppearanceProvider>
			<LocaleProvider>
				<Row />
			</LocaleProvider>
		</AppearanceProvider>,
	);
}

const hint = (n: number) =>
	screen.getByRole("radio", { name: `Piet: ${n}` }).props.accessibilityHint;

describe("a selected score says a second tap clears it (APP-915)", () => {
	it.each([
		["en", "Tap again to clear the score"],
		["nl", "Tik nogmaals om de score te wissen"],
	] as const)("in %s", async (locale, text) => {
		await renderIn(locale);
		expect(hint(4)).toBeUndefined();

		await fireEvent.press(screen.getByRole("radio", { name: "Piet: 4" }));
		expect(hint(4)).toBe(text);
		expect(hint(5)).toBeUndefined();

		await fireEvent.press(screen.getByRole("radio", { name: "Piet: 4" }));
		expect(
			screen.getByRole("radio", { name: "Piet: 4" }).props.accessibilityState,
		).toMatchObject({ checked: false });
		expect(hint(4)).toBeUndefined();
	});
});
