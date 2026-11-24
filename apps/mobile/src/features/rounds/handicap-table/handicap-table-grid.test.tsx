import { handicapTable } from "@fairway/core/handicap-table";
import { render, screen } from "@testing-library/react-native";
import { type Locale, LocaleProvider } from "../../../i18n";
import {
	PREFERENCE_KEYS,
	writePreference,
} from "../../../prefs/local-preference";
import { AppearanceProvider } from "../../../theme";
import { HandicapTableGrid } from "./handicap-table-grid";

const holes = Array.from({ length: 9 }, (_, i) => ({
	ref: String(i + 1),
	par: 4,
	strokeIndex: i + 1,
}));
const players = [
	{ name: "Piet", playingHandicap: 10 },
	{ name: "Jan", playingHandicap: -1 },
	{ name: "Kees" },
];

async function renderIn(locale: Locale) {
	writePreference(PREFERENCE_KEYS.locale, locale);
	await render(
		<AppearanceProvider>
			<LocaleProvider>
				<HandicapTableGrid
					rows={handicapTable(holes, players) ?? []}
					players={players}
					currentHole={2}
				/>
			</LocaleProvider>
		</AppearanceProvider>,
	);
}

describe("HandicapTableGrid", () => {
	it("labels every cell in Dutch", async () => {
		await renderIn("nl");
		expect(screen.getAllByLabelText("Piet: 2 slagen")).toHaveLength(1);
		expect(screen.getAllByLabelText("Piet: 1 slag")).toHaveLength(8);
		expect(screen.getAllByLabelText("Jan: geeft 1 slag terug")).toHaveLength(1);
		expect(screen.getAllByLabelText("Kees: 0 slagen")).toHaveLength(9);
	});

	it("labels every cell in English", async () => {
		await renderIn("en");
		expect(screen.getAllByLabelText("Piet: 1 stroke")).toHaveLength(8);
		expect(screen.getAllByLabelText("Jan: gives 1 stroke back")).toHaveLength(
			1,
		);
	});

	it("draws dots, strokes given back and playing handicaps", async () => {
		await renderIn("nl");
		expect(screen.getByText("●●")).toBeTruthy();
		expect(screen.getByText("−1")).toBeTruthy();
		expect(screen.getByText("+1")).toBeTruthy();
		expect(screen.getByText("–")).toBeTruthy();
	});

	it("marks only the current hole as selected", async () => {
		await renderIn("nl");
		expect(
			screen.getByLabelText("Hole 3").props.accessibilityState,
		).toMatchObject({ selected: true });
		expect(
			screen.getByLabelText("Hole 4").props.accessibilityState,
		).toMatchObject({ selected: false });
	});
});
