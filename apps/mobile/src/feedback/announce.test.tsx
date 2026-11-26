import { renderHook } from "@testing-library/react-native";
import { AccessibilityInfo, Platform } from "react-native";
import { useAnnounceChange } from "./announce";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));

describe("useAnnounceChange", () => {
	const announce = jest
		.spyOn(AccessibilityInfo, "announceForAccessibility")
		.mockImplementation(() => {});
	afterEach(() => {
		announce.mockClear();
		mockFocused = true;
	});

	const announcer = ({ text }: { text: string }) => useAnnounceChange(text);

	it("announces a changed status on iOS, not the first one", async () => {
		expect(Platform.OS).toBe("ios");
		const { rerender } = await renderHook(announcer, {
			initialProps: { text: "Eric 1 up" },
		});
		expect(announce).not.toHaveBeenCalled();
		await rerender({ text: "Eric 1 up" });
		expect(announce).not.toHaveBeenCalled();
		await rerender({ text: "All square" });
		expect(announce).toHaveBeenCalledWith("All square");
		expect(announce).toHaveBeenCalledTimes(1);
	});

	it("stays quiet on a screen under the focused one", async () => {
		mockFocused = false;
		const { rerender } = await renderHook(announcer, {
			initialProps: { text: "Eric 1 up" },
		});
		await rerender({ text: "All square" });
		expect(announce).not.toHaveBeenCalled();

		// Back on top, the screen does not replay the change it missed.
		mockFocused = true;
		await rerender({ text: "All square" });
		expect(announce).not.toHaveBeenCalled();
		await rerender({ text: "Eric 1 down" });
		expect(announce).toHaveBeenCalledWith("Eric 1 down");
	});
});
