import {
	accountNameFieldTraits,
	CLERK_PASSWORD_RULES,
	type Credentials,
	createCredentialsForm,
	credentialsReady,
	currentPasswordTraits,
	emailFieldTraits,
	newPasswordTraits,
	passwordFieldTraits,
} from "./credentials-model";

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

describe("credentialsReady", () => {
	it("needs an email and a password", () => {
		expect(credentialsReady({ email: " a@b.nl ", password: "x" })).toBe(true);
		expect(credentialsReady({ email: "   ", password: "x" })).toBe(false);
		expect(credentialsReady({ email: "a@b.nl", password: "" })).toBe(false);
	});
});

/** A form whose focused field, if any, is the returned `blur` mock. */
function setup(initial: Credentials = { email: "", password: "" }) {
	const submit = jest.fn();
	const onValues = jest.fn();
	const onEditing = jest.fn();
	const blur = jest.fn();
	let focused = false;
	const form = createCredentialsForm(initial, {
		onValues,
		onEditing,
		submit,
		focusedInput: () => (focused ? { blur } : null),
	});
	const focus = () => {
		focused = true;
		form.focus();
	};
	/** What iOS AutoFill does: native text changes, only `onEndEditing` reports it. */
	const endEditing = (key: keyof Credentials, text: string) => {
		focused = false;
		form.endEditing(key, text);
	};
	return { form, submit, onValues, onEditing, blur, focus, endEditing };
}

describe("createCredentialsForm", () => {
	it("keeps the text AutoFill set without onChangeText", () => {
		const { form, submit, onValues, endEditing } = setup();
		endEditing("email", "a@b.nl");
		endEditing("password", "saved-pw");
		expect(onValues).toHaveBeenLastCalledWith({
			email: "a@b.nl",
			password: "saved-pw",
		});
		form.press();
		expect(submit).toHaveBeenCalledWith({
			email: "a@b.nl",
			password: "saved-pw",
		});
	});

	it("waits for the focused field's final text when the button is pressed before onEndEditing", () => {
		const { form, submit, blur, focus, endEditing } = setup();
		form.changeText("email", "a@b.nl");
		focus();
		form.changeText("password", "old-pw");
		form.press();
		expect(blur).toHaveBeenCalledTimes(1);
		expect(submit).not.toHaveBeenCalled();
		endEditing("password", "Strong-Generated-1");
		expect(submit).toHaveBeenCalledTimes(1);
		expect(submit).toHaveBeenCalledWith({
			email: "a@b.nl",
			password: "Strong-Generated-1",
		});
	});

	it("reports editing while a field is focused, so the button can stay enabled", () => {
		const { onEditing, focus, endEditing } = setup();
		focus();
		expect(onEditing).toHaveBeenLastCalledWith(true);
		endEditing("password", "");
		expect(onEditing).toHaveBeenLastCalledWith(false);
	});

	it("does not submit on a later end of editing once focus moved on", () => {
		const { form, submit, focus, endEditing } = setup();
		focus();
		form.press();
		focus();
		endEditing("email", "a@b.nl");
		expect(submit).not.toHaveBeenCalled();
	});

	it("submits the keyboard Go's own text", () => {
		const { form, submit } = setup({ email: "a@b.nl", password: "" });
		form.submitEditing("password", "filled-pw");
		expect(submit).toHaveBeenCalledWith({
			email: "a@b.nl",
			password: "filled-pw",
		});
	});

	it("hands submit an empty password after AutoFill clears a declined strong password", () => {
		const { form, submit, onValues, focus, endEditing } = setup();
		form.changeText("email", "a@b.nl");
		focus();
		form.changeText("password", "Strong-Generated-1");
		endEditing("password", "");
		expect(onValues).toHaveBeenLastCalledWith({
			email: "a@b.nl",
			password: "",
		});
		form.press();
		expect(submit).toHaveBeenCalledWith({ email: "a@b.nl", password: "" });
	});
});

describe("password-setting screens", () => {
	it("names the account with a read-only username field", () => {
		expect(accountNameFieldTraits).toMatchObject({
			textContentType: "username",
			autoComplete: "username",
			editable: false,
		});
	});

	it("tells the current and new password apart, and the new one follows Clerk's policy", () => {
		expect(currentPasswordTraits).toEqual({
			autoComplete: "current-password",
			textContentType: "password",
		});
		expect(newPasswordTraits).toEqual({
			autoComplete: "new-password",
			textContentType: "newPassword",
			passwordRules: CLERK_PASSWORD_RULES,
		});
	});

	it("submits a current/new pair from the focused field's final text", () => {
		const submit = jest.fn();
		const blur = jest.fn();
		let focused = true;
		const form = createCredentialsForm(
			{ current: "", next: "" },
			{
				onValues: () => {},
				onEditing: () => {},
				submit,
				focusedInput: () => (focused ? { blur } : null),
			},
		);
		form.endEditing("current", "old-pw");
		form.focus();
		form.press();
		expect(submit).not.toHaveBeenCalled();
		focused = false;
		// Declining "Use Strong Password?" may clear the field silently.
		form.endEditing("next", "");
		expect(submit).toHaveBeenCalledWith({ current: "old-pw", next: "" });
	});
});
