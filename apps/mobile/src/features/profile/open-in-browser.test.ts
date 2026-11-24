import { openBrowserAsync } from "expo-web-browser";
import { showAlert } from "../../monitoring/native-presentation";
import { openInBrowser } from "./open-in-browser";

jest.mock("expo-web-browser", () => ({
	openBrowserAsync: jest.fn(() => Promise.resolve({ type: "opened" })),
}));
jest.mock("../../monitoring/native-presentation", () => ({
	showAlert: jest.fn(),
}));

const failure = { title: "Privacy policy", message: "Could not open." };

beforeEach(() => {
	jest.mocked(openBrowserAsync).mockClear();
	jest.mocked(showAlert).mockClear();
});

it("opens the page in the in-app browser", async () => {
	await openInBrowser("https://fairway.appelent.nl/privacy", failure);
	expect(openBrowserAsync).toHaveBeenCalledWith(
		"https://fairway.appelent.nl/privacy",
	);
	expect(showAlert).not.toHaveBeenCalled();
});

it("tells the player when the browser cannot open", async () => {
	jest
		.mocked(openBrowserAsync)
		.mockRejectedValueOnce(new Error("No matching browser"));
	await openInBrowser("https://fairway.appelent.nl/privacy", failure);
	expect(showAlert).toHaveBeenCalledWith("Privacy policy", "Could not open.");
});
