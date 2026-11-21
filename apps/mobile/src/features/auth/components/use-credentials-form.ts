import { useRef, useState } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { type CredentialKey, createCredentialsForm } from "./credentials-model";

/**
 * React state around `createCredentialsForm`: field props for each credential,
 * the primary button's `press`, and `editing` while a field is focused.
 * `onSubmit` gets the latest text from the field events, not from state.
 */
export function useCredentialsForm<K extends string = CredentialKey>(
	initial: Record<K, string>,
	onSubmit: (values: Record<K, string>) => void,
) {
	const [values, setValues] = useState(initial);
	const [editing, setEditing] = useState(false);
	const submitRef = useRef(onSubmit);
	submitRef.current = onSubmit;
	const [form] = useState(() =>
		createCredentialsForm<K>(initial, {
			onValues: setValues,
			onEditing: setEditing,
			focusedInput: () => TextInput.State.currentlyFocusedInput(),
			submit: (latest) => submitRef.current(latest),
		}),
	);

	const field = (key: K) =>
		({
			value: values[key],
			onChangeText: (text) => form.changeText(key, text),
			onFocus: form.focus,
			onEndEditing: (event) => form.endEditing(key, event.nativeEvent.text),
		}) satisfies TextInputProps;

	/** `onSubmitEditing` for the last field: its event has the final text. */
	const submitFrom =
		(key: K): TextInputProps["onSubmitEditing"] =>
		(event) =>
			form.submitEditing(key, event.nativeEvent.text);

	return { values, editing, field, submitFrom, press: form.press };
}

export type CredentialsFormState<K extends string = CredentialKey> = ReturnType<
	typeof useCredentialsForm<K>
>;
