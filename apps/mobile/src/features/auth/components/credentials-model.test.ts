import type { TextInputEndEditingEvent } from "react-native";
import {
	CLERK_PASSWORD_RULES,
	credentialsReady,
	emailFieldTraits,
	passwordFieldTraits,
	syncNativeText,
} from "./credentials-model";

const endEditing = (text: string) =>
	({ nativeEvent: { text } }) as TextInputEndEditingEvent;

describe("credential field traits", () => {
	it("marks the email as the account name", () => {
		expect(emailFieldTraits).toEqual({
			autoComplete: "username",
			textContentType: "username",
		});
	});

	it("asks for a new password within Clerk's default policy on sign-up", () => {
		expect(CLERK_PASSWORD_RULES).toBe("minlength: 8;");
		expect(passwordFieldTraits("sign-up")).toEqual({
			autoComplete: "new-password",
			textContentType: "newPassword",
			passwordRules: "minlength: 8;",
		});
	});

	it("asks for the saved password on sign-in, without rules", () => {
		expect(passwordFieldTraits("sign-in")).toEqual({
			autoComplete: "current-password",
			textContentType: "password",
		});
	});
});

describe("syncNativeText", () => {
	it("takes the typed text", () => {
		const set = jest.fn();
		syncNativeText(set).onChangeText?.("golfer@example.com");
		expect(set).toHaveBeenCalledWith("golfer@example.com");
	});

	it("takes the native text when editing ends, which AutoFill may have set or cleared", () => {
		const set = jest.fn();
		const props = syncNativeText(set);
		props.onEndEditing?.(endEditing("Strong-Generated-1"));
		props.onEndEditing?.(endEditing(""));
		expect(set.mock.calls).toEqual([["Strong-Generated-1"], [""]]);
	});
});

describe("credentialsReady", () => {
	it("needs an email and a password", () => {
		expect(credentialsReady(" a@b.nl ", "x")).toBe(true);
		expect(credentialsReady("   ", "x")).toBe(false);
		expect(credentialsReady("a@b.nl", "")).toBe(false);
	});
});
