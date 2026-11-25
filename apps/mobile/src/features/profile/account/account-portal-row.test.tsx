import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import { openBrowserAsync } from "expo-web-browser";
import { type Locale, LocaleProvider } from "../../../i18n";
import { showAlert } from "../../../monitoring/native-presentation";
import {
	PREFERENCE_KEYS,
	writePreference,
} from "../../../prefs/local-preference";
import { AppearanceProvider } from "../../../theme";
import { AccountPortalRow } from "./account-portal-row";

jest.mock("../../../monitoring/native-presentation", () => ({
	showAlert: jest.fn(),
}));

// The React Native drawing of the row: the SwiftUI one has no queryable text.
jest.mock("../../../ui/inset-list", () =>
	jest.requireActual("../../../ui/inset-list.tsx"),
);
jest.mock("expo-web-browser", () => ({
	openBrowserAsync: jest.fn(() => Promise.resolve({ type: "opened" })),
}));

async function renderIn(locale: Locale) {
	writePreference(PREFERENCE_KEYS.locale, locale);
	await render(
		<AppearanceProvider>
			<LocaleProvider>
				<AccountPortalRow />
			</LocaleProvider>
		</AppearanceProvider>,
	);
}

beforeEach(() => {
	jest.mocked(openBrowserAsync).mockClear();
	jest.mocked(showAlert).mockClear();
});

it.each([
	["en", "Manage your AppElent account"],
	["nl", "Beheer je AppElent-account"],
] as const)("names the row in %s", async (locale, title) => {
	await renderIn(locale);
	expect(screen.getByRole("button", { name: title })).toBeTruthy();
});

it("opens the account portal in the in-app browser", async () => {
	await renderIn("en");
	fireEvent.press(
		screen.getByRole("button", { name: "Manage your AppElent account" }),
	);
	expect(openBrowserAsync).toHaveBeenCalledTimes(1);
	expect(openBrowserAsync).toHaveBeenCalledWith("https://account.appelent.nl");
});

it.each([
	["en", "Manage your AppElent account", "Opens in the browser"],
	["nl", "Beheer je AppElent-account", "Opent in de browser"],
] as const)(
	"says in %s that the row leaves the app",
	async (locale, title, hint) => {
		await renderIn(locale);
		expect(
			screen.getByRole("button", { name: title }).props.accessibilityHint,
		).toBe(hint);
	},
);

it("opens the account portal without an alert", async () => {
	await renderIn("en");
	fireEvent.press(
		screen.getByRole("button", { name: "Manage your AppElent account" }),
	);
	await Promise.resolve();
	expect(showAlert).not.toHaveBeenCalled();
});

it.each([
	[
		"en",
		"Manage your AppElent account",
		"This page could not be opened. Try again in a moment.",
	],
	[
		"nl",
		"Beheer je AppElent-account",
		"Deze pagina kon niet worden geopend. Probeer het zo opnieuw.",
	],
] as const)(
	"says so in %s when the browser cannot open",
	async (locale, title, message) => {
		jest.mocked(openBrowserAsync).mockRejectedValueOnce(new Error("busy"));
		await renderIn(locale);
		fireEvent.press(screen.getByRole("button", { name: title }));
		await waitFor(() => expect(showAlert).toHaveBeenCalledWith(title, message));
		expect(openBrowserAsync).toHaveBeenCalledTimes(1);
	},
);
