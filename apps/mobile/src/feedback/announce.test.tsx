import { renderHook } from "@testing-library/react-native";
import { AccessibilityInfo, Platform } from "react-native";
import { useAnnounceChange } from "./announce";

describe("useAnnounceChange", () => {
	const announce = jest
		.spyOn(AccessibilityInfo, "announceForAccessibility")
		.mockImplementation(() => {});
	afterEach(() => announce.mockClear());

	it("announces a changed status on iOS, not the first one", async () => {
		expect(Platform.OS).toBe("ios");
		const { rerender } = await renderHook(
			({ text }: { text: string }) => useAnnounceChange(text),
			{ initialProps: { text: "Eric 1 up" } },
		);
		expect(announce).not.toHaveBeenCalled();
		await rerender({ text: "Eric 1 up" });
		expect(announce).not.toHaveBeenCalled();
		await rerender({ text: "All square" });
		expect(announce).toHaveBeenCalledWith("All square");
		expect(announce).toHaveBeenCalledTimes(1);
	});
});
