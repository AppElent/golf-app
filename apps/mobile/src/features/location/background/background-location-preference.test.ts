import * as Location from "expo-location";
import {
	backgroundLocationPreferred,
	setBackgroundLocationPreferred,
} from "./background-location-preference";

jest.mock("expo-location", () => ({
	requestForegroundPermissionsAsync: jest.fn(),
	getBackgroundPermissionsAsync: jest.fn(),
	requestBackgroundPermissionsAsync: jest.fn(),
}));

const loc = Location as jest.Mocked<typeof Location>;
const perm = (granted: boolean, canAskAgain = true) =>
	({ granted, canAskAgain }) as Location.LocationPermissionResponse;

beforeEach(async () => {
	jest.useFakeTimers();
	jest.resetAllMocks();
	loc.requestForegroundPermissionsAsync.mockResolvedValue(perm(true));
	await setBackgroundLocationPreferred(false);
});
afterEach(() => jest.useRealTimers());

it("waits for the iOS 'Change to Always' prompt before deciding", async () => {
	loc.getBackgroundPermissionsAsync
		.mockResolvedValueOnce(perm(false, true)) // before asking
		.mockResolvedValueOnce(perm(false, false)) // prompt still up
		.mockResolvedValueOnce(perm(true)); // user chose Always
	loc.requestBackgroundPermissionsAsync.mockResolvedValue(perm(false, false));

	const result = setBackgroundLocationPreferred(true);
	await jest.advanceTimersByTimeAsync(1000);

	await expect(result).resolves.toEqual({ on: true, needsSettings: false });
	expect(backgroundLocationPreferred()).toBe(true);
});

it("stays off when the prompt closes without Always", async () => {
	loc.getBackgroundPermissionsAsync.mockResolvedValue(perm(false, true));
	loc.requestBackgroundPermissionsAsync.mockResolvedValue(perm(false, true));

	const result = setBackgroundLocationPreferred(true);
	await jest.advanceTimersByTimeAsync(60_000);

	await expect(result).resolves.toEqual({ on: false, needsSettings: false });
	expect(backgroundLocationPreferred()).toBe(false);
});

it("sends the user to Settings when iOS can no longer ask", async () => {
	loc.getBackgroundPermissionsAsync.mockResolvedValue(perm(false, false));
	loc.requestBackgroundPermissionsAsync.mockResolvedValue(perm(false, false));

	await expect(setBackgroundLocationPreferred(true)).resolves.toEqual({
		on: false,
		needsSettings: true,
	});
	expect(backgroundLocationPreferred()).toBe(false);
});

it("stays off when location is refused outright", async () => {
	loc.requestForegroundPermissionsAsync.mockResolvedValue(perm(false, false));

	await expect(setBackgroundLocationPreferred(true)).resolves.toEqual({
		on: false,
		needsSettings: true,
	});
	expect(loc.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
	expect(backgroundLocationPreferred()).toBe(false);
});

it("turns off without asking", async () => {
	loc.getBackgroundPermissionsAsync.mockResolvedValue(perm(true));
	loc.requestBackgroundPermissionsAsync.mockResolvedValue(perm(true));
	await setBackgroundLocationPreferred(true);
	expect(backgroundLocationPreferred()).toBe(true);
	loc.requestForegroundPermissionsAsync.mockClear();

	await expect(setBackgroundLocationPreferred(false)).resolves.toEqual({
		on: false,
		needsSettings: false,
	});
	expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
	expect(backgroundLocationPreferred()).toBe(false);
});
