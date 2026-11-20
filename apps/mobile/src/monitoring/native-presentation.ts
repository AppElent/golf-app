/**
 * The only place the app presents a system alert, action sheet or share sheet.
 *
 * Each is presented from the root view controller, the same one Sentry's
 * feedback form needs, so a shake while one is open would strand the form's
 * backdrop. These wrappers hold shake-to-report for as long as the
 * presentation is up and release on every way out. `biome.json` bans importing
 * `Alert`, `ActionSheetIOS` and `Share` from `react-native` anywhere else.
 *
 * Copied from Foundry (AppElent/workouts `src/observability/native-presentation.ts`);
 * Fairway has no image picker, so the share sheet takes its place.
 */

import {
	ActionSheetIOS,
	type ActionSheetIOSOptions,
	Alert,
	type AlertButton,
	type AlertOptions,
	Share,
} from "react-native";
import { holdShakeToReport } from "./shake-to-report";

/** `Alert.alert`, holding shake-to-report until a button or the dismissal. */
export function showAlert(
	title: string,
	message?: string,
	buttons?: AlertButton[],
	options?: AlertOptions,
) {
	const release = holdShakeToReport();
	// With no buttons iOS adds an OK nobody can observe, so name it here.
	const shown = buttons?.length ? buttons : [{ text: "OK" }];
	try {
		Alert.alert(
			title,
			message,
			shown.map((button) => ({
				...button,
				onPress: (value?: string) => {
					release();
					button.onPress?.(value);
				},
			})),
			{
				...options,
				onDismiss: () => {
					release();
					options?.onDismiss?.();
				},
			},
		);
	} catch (error) {
		release();
		throw error;
	}
}

/** `ActionSheetIOS.showActionSheetWithOptions`, held until a choice or a tap away. */
export function showActionSheet(
	options: ActionSheetIOSOptions,
	callback: (buttonIndex: number) => void,
) {
	const release = holdShakeToReport();
	try {
		ActionSheetIOS.showActionSheetWithOptions(options, (index) => {
			release();
			callback(index);
		});
	} catch (error) {
		release();
		throw error;
	}
}

/** `Share.share`, held until the share sheet closes (iOS resolves then). */
export async function share(...args: Parameters<typeof Share.share>) {
	const release = holdShakeToReport();
	try {
		return await Share.share(...args);
	} finally {
		release();
	}
}
