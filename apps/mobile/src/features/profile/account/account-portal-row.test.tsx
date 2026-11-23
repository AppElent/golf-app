import { fireEvent, render, screen } from "@testing-library/react-native";
import { openBrowserAsync } from "expo-web-browser";
import { type Locale, LocaleProvider } from "../../../i18n";
import {
	PREFERENCE_KEYS,
	writePreference,
} from "../../../prefs/local-preference";
import { AppearanceProvider } from "../../../theme";
import { AccountPortalRow } from "./account-portal-row";

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

it("stays quiet when the browser cannot open", async () => {
	jest.mocked(openBrowserAsync).mockRejectedValueOnce(new Error("busy"));
	await renderIn("en");
	fireEvent.press(
		screen.getByRole("button", { name: "Manage your AppElent account" }),
	);
	await Promise.resolve();
	expect(openBrowserAsync).toHaveBeenCalledTimes(1);
});
