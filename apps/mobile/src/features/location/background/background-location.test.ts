import * as Location from "expo-location";
import { readPreference } from "../../../prefs/local-preference";
import { setBackgroundLocationPreferred } from "./background-location";

jest.mock("expo-location", () => ({
	requestForegroundPermissionsAsync: jest.fn(),
	getBackgroundPermissionsAsync: jest.fn(),
	requestBackgroundPermissionsAsync: jest.fn(),
}));
jest.mock("../../live/live-hole", () => ({ liveHolePosition: jest.fn() }));
jest.mock("expo-task-manager", () => ({
	isTaskDefined: () => false,
	defineTask: jest.fn(),
}));

const loc = Location as jest.Mocked<typeof Location>;
const perm = (granted: boolean, canAskAgain = true) =>
	({ granted, canAskAgain }) as Location.LocationPermissionResponse;

beforeEach(() => {
	jest.useFakeTimers();
	jest.resetAllMocks();
	loc.requestForegroundPermissionsAsync.mockResolvedValue(perm(true));
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
	expect(readPreference("fairway:background-location")).toBe("on");
});

it("sends the user to Settings when iOS can no longer ask", async () => {
	loc.getBackgroundPermissionsAsync.mockResolvedValue(perm(false, false));
	loc.requestBackgroundPermissionsAsync.mockResolvedValue(perm(false, false));

	await expect(setBackgroundLocationPreferred(true)).resolves.toEqual({
		on: false,
		needsSettings: true,
	});
	expect(loc.getBackgroundPermissionsAsync).toHaveBeenCalledTimes(1);
});

it("turns off without asking", async () => {
	await expect(setBackgroundLocationPreferred(false)).resolves.toEqual({
		on: false,
		needsSettings: false,
	});
	expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
	expect(readPreference("fairway:background-location")).toBe("off");
});
