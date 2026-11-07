/**
 * What the phone has to know before it can draw a frame.
 *
 * Local because language and appearance belong to this phone rather than the
 * account: they apply while Clerk resolves a cached session, while Convex is
 * unreachable, and on the signed-out screens. Synchronous because the first
 * frame after a cold start has to be the right one.
 *
 * `expo-sqlite/kv-store` is the only Expo persistence module with a synchronous
 * read (`getItemSync`); `expo-secure-store` only has `getItemAsync`.
 *
 * A store that will not open means a forgotten preference, not an error, so
 * every reader treats `null` as "never chosen". The `try` blocks cover reading
 * and writing, not the import: a client whose native side predates `expo-sqlite`
 * throws on load and needs a rebuilt dev client.
 */
import Storage from "expo-sqlite/kv-store";

export const PREFERENCE_KEYS = {
	locale: "fairway:locale",
	appearance: "fairway:appearance",
	/** Opt-in: keep tracking position while the phone is locked during a round. */
	backgroundLocation: "fairway:background-location",
} as const;

type PreferenceKey = (typeof PREFERENCE_KEYS)[keyof typeof PREFERENCE_KEYS];

/** What was stored under this key, or `null` if nothing readable was. */
export function readPreference(key: PreferenceKey): string | null {
	try {
		return Storage.getItemSync(key);
	} catch {
		return null;
	}
}

export function writePreference(key: PreferenceKey, value: string) {
	try {
		Storage.setItemSync(key, value);
		return true;
	} catch {
		// Ignored: the next launch falls back to this preference's default.
		return false;
	}
}
