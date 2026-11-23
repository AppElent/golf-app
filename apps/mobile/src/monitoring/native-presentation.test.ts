import * as Sentry from "@sentry/react-native";
import { ActionSheetIOS, Alert, type AlertButton, Share } from "react-native";
import { share, showActionSheet, showAlert } from "./native-presentation";
import {
	DISMISS_SETTLE_MS,
	resetShakeToReportForTests,
	startShakeToReport,
} from "./shake-to-report";

const settle = () => jest.advanceTimersByTime(DISMISS_SETTLE_MS);
const paused = () => jest.mocked(Sentry.disableFeedbackOnShake);
const listening = () => jest.mocked(Sentry.enableFeedbackOnShake);

beforeEach(() => {
	jest.useFakeTimers();
	resetShakeToReportForTests();
	jest.restoreAllMocks();
	paused().mockClear();
	listening().mockClear();
	startShakeToReport();
	listening().mockClear();
});

afterEach(() => {
	jest.useRealTimers();
});

describe("showAlert", () => {
	function open(buttons?: AlertButton[], onDismiss?: () => void) {
		const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
		showAlert("Title", "Body", buttons, { cancelable: true, onDismiss });
		const [, , shown, options] = alert.mock.calls[0];
		return { shown: shown ?? [], options };
	}

	it("pauses shake while open and resumes after a button press settles", () => {
		const onPress = jest.fn();
		const { shown } = open([{ text: "Delete", onPress }]);
		expect(paused()).toHaveBeenCalledTimes(1);

		shown[0].onPress?.();
		expect(onPress).toHaveBeenCalledTimes(1);
		expect(listening()).not.toHaveBeenCalled();
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});

	it("releases for the implicit OK button when no buttons are passed", () => {
		const { shown } = open();
		expect(shown).toHaveLength(1);
		shown[0].onPress?.();
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});

	it("releases on dismiss and still calls the caller's onDismiss", () => {
		const onDismiss = jest.fn();
		const { options } = open([{ text: "OK" }], onDismiss);
		options?.onDismiss?.();
		expect(onDismiss).toHaveBeenCalledTimes(1);
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});

	it("releases once when both a button and dismiss fire", () => {
		const { shown, options } = open([{ text: "OK" }]);
		shown[0].onPress?.();
		options?.onDismiss?.();
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});

	it("releases when Alert.alert throws", () => {
		jest.spyOn(Alert, "alert").mockImplementation(() => {
			throw new Error("boom");
		});
		expect(() => showAlert("Title")).toThrow("boom");
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});
});

describe("showActionSheet", () => {
	it("pauses shake until a choice, then calls back", () => {
		const sheet = jest
			.spyOn(ActionSheetIOS, "showActionSheetWithOptions")
			.mockImplementation(() => {});
		const callback = jest.fn();
		showActionSheet(
			{ options: ["A", "Cancel"], cancelButtonIndex: 1 },
			callback,
		);
		expect(paused()).toHaveBeenCalledTimes(1);

		sheet.mock.calls[0][1](1);
		expect(callback).toHaveBeenCalledWith(1);
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});
});

describe("share", () => {
	it("pauses shake while the share sheet is open and resumes after it settles", async () => {
		let finish: (result: unknown) => void = () => {};
		const native = jest
			.spyOn(Share, "share")
			.mockReturnValue(new Promise((resolve) => (finish = resolve)) as never);
		const pending = share({ message: "Round" });
		expect(paused()).toHaveBeenCalledTimes(1);
		expect(native).toHaveBeenCalledWith({ message: "Round" });

		finish({ action: "dismissedAction" });
		await expect(pending).resolves.toEqual({ action: "dismissedAction" });
		expect(listening()).not.toHaveBeenCalled();
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});

	it("releases when the share sheet fails", async () => {
		jest.spyOn(Share, "share").mockRejectedValue(new Error("no sheet"));
		await expect(share({ message: "Round" })).rejects.toThrow("no sheet");
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});
});
