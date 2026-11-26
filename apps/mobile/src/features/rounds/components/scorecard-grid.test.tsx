import { render, screen } from "@testing-library/react-native";
import { type Locale, LocaleProvider } from "../../../i18n";
import {
	PREFERENCE_KEYS,
	writePreference,
} from "../../../prefs/local-preference";
import { AppearanceProvider } from "../../../theme";
import { ScorecardGrid } from "./scorecard-grid";
import { cardRows } from "./scorecard-model";

const holes = Array.from({ length: 9 }, (_, i) => ({
	ref: String(i + 1),
	par: 4,
	strokeIndex: i + 1,
}));
const players = [{ name: "Piet" }, { name: "Jan" }];
// Piet gets two strokes on hole 1; Jan, a plus player, gives one back on hole 9.
const received = [
	[2, 1, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0, -1],
];
const scores = [
	{ holeIndex: 0, playerIndex: 0, strokes: 5 },
	{ holeIndex: 0, playerIndex: 1, strokes: 4 },
];

async function renderIn(locale: Locale) {
	writePreference(PREFERENCE_KEYS.locale, locale);
	await render(
		<AppearanceProvider>
			<LocaleProvider>
				<ScorecardGrid
					holes={holes}
					players={players}
					rows={cardRows(holes, scores, received)}
					received={received}
				/>
			</LocaleProvider>
		</AppearanceProvider>,
	);
}

describe("ScorecardGrid stroke dots", () => {
	it("draws strokes received filled and strokes given back hollow", async () => {
		await renderIn("en");
		expect(screen.getAllByTestId("stroke-dot")).toHaveLength(3);
		expect(screen.getAllByTestId("stroke-dot-given")).toHaveLength(1);
	});

	it("says who gives a stroke back", async () => {
		await renderIn("nl");
		expect(screen.getByHintText("Jan geeft 1 slag terug")).toBeTruthy();
		expect(screen.getByHintText("Piet krijgt 2 slagen")).toBeTruthy();
	});
});
