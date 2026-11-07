import * as Location from "expo-location";
import {
	PREFERENCE_KEYS,
	readPreference,
	writePreference,
} from "../../../prefs/local-preference";

/** Half-second reads while the iOS prompt may be up (15 s). */
const PROMPT_POLLS = 30;

export function backgroundLocationPreferred(): boolean {
	return readPreference(PREFERENCE_KEYS.backgroundLocation) === "on";
}

/**
 * Turn the preference on (asking for Always first) or off. Resolves to the
 * stored state, plus whether iOS would no longer show its prompt (the user has
 * to go to Settings).
 */
export async function setBackgroundLocationPreferred(
	on: boolean,
): Promise<{ on: boolean; needsSettings: boolean }> {
	if (!on) {
		writePreference(PREFERENCE_KEYS.backgroundLocation, "off");
		return { on: false, needsSettings: false };
	}
	try {
		const fg = await Location.requestForegroundPermissionsAsync();
		if (!fg.granted) return { on: false, needsSettings: !fg.canAskAgain };
		const before = await Location.getBackgroundPermissionsAsync();
		let bg = await Location.requestBackgroundPermissionsAsync();
		// iOS resolves at once with "when in use" while its "Change to Always"
		// prompt is still up, and sends no event when it closes: re-read for a
		// while.
		for (
			let i = 0;
			!bg.granted && before.canAskAgain && i < PROMPT_POLLS;
			i++
		) {
			await new Promise((r) => setTimeout(r, 500));
			bg = await Location.getBackgroundPermissionsAsync();
		}
		if (!bg.granted) return { on: false, needsSettings: !before.canAskAgain };
	} catch {
		return { on: false, needsSettings: false };
	}
	return {
		on: writePreference(PREFERENCE_KEYS.backgroundLocation, "on"),
		needsSettings: false,
	};
}
