import { act, renderHook } from "@testing-library/react-native";
import { AccessibilityInfo, Platform } from "react-native";
import { ANNOUNCE_DELAY_MS, useAnnounceChange } from "./announce";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));

describe("useAnnounceChange", () => {
	const announce = jest
		.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions")
		.mockImplementation(() => {});
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
		announce.mockClear();
		mockFocused = true;
	});

	const announcer = ({ text }: { text: string }) => useAnnounceChange(text);
	const settle = () => act(() => jest.advanceTimersByTime(ANNOUNCE_DELAY_MS));

	it("announces a changed status on iOS, not the first one", async () => {
		expect(Platform.OS).toBe("ios");
		const { rerender } = await renderHook(announcer, {
			initialProps: { text: "Eric 1 up" },
		});
		await rerender({ text: "Eric 1 up" });
		await settle();
		expect(announce).not.toHaveBeenCalled();
		await rerender({ text: "All square" });
		await settle();
		expect(announce).toHaveBeenCalledWith("All square", { queue: true });
		expect(announce).toHaveBeenCalledTimes(1);
	});

	it("speaks once, queued, after a sheet that closes on the same save", async () => {
		// The score sheet's standing changes on Save, then `router.back()`
		// unmounts it straight away; the play screen below is not focused.
		const sheet = await renderHook(announcer, {
			initialProps: { text: "Eric 1 up" },
		});
		mockFocused = false;
		const below = await renderHook(announcer, {
			initialProps: { text: "Eric 1 up" },
		});
		mockFocused = true;
		await sheet.rerender({ text: "All square" });
		mockFocused = false;
		await below.rerender({ text: "All square" });
		await sheet.unmount();
		expect(announce).not.toHaveBeenCalled();

		mockFocused = true;
		await below.rerender({ text: "All square" });
		await settle();
		expect(announce).toHaveBeenCalledTimes(1);
		expect(announce).toHaveBeenCalledWith("All square", { queue: true });
	});

	it("speaks only the newest of changes that come in quick succession", async () => {
		const { rerender } = await renderHook(announcer, {
			initialProps: { text: "Eric 1 up" },
		});
		await rerender({ text: "All square" });
		await rerender({ text: "Eric 1 down" });
		await settle();
		expect(announce).toHaveBeenCalledTimes(1);
		expect(announce).toHaveBeenCalledWith("Eric 1 down", { queue: true });
	});

	it("stays quiet on a screen under the focused one", async () => {
		mockFocused = false;
		const { rerender } = await renderHook(announcer, {
			initialProps: { text: "Eric 1 up" },
		});
		await rerender({ text: "All square" });
		await settle();
		expect(announce).not.toHaveBeenCalled();

		// Back on top, the screen does not replay the change it missed.
		mockFocused = true;
		await rerender({ text: "All square" });
		await settle();
		expect(announce).not.toHaveBeenCalled();
		await rerender({ text: "Eric 1 down" });
		await settle();
		expect(announce).toHaveBeenCalledWith("Eric 1 down", { queue: true });
	});
});
