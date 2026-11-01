/**
 * Where the phone remembers the things it has to know *before* it can draw a
 * frame. The mechanism is the interesting part, not the key count.
 *
 * **Local, and synchronous.** Local because the language is a property of this
 * phone rather than of the signed-in account: it has to work while Clerk is
 * still resolving a cached session, while Convex is unreachable, and on the
 * signed-out screens. Synchronous because the first frame after a cold start
 * has to be the right one — an awaited read means a frame painted in a language
 * somebody has already rejected, and #69 forbids exactly that flash.
 *
 * `expo-sqlite/kv-store` is the store for that one property: it is the only
 * Expo persistence module with a synchronous read (`getItemSync`).
 * `expo-secure-store` has `getItemAsync` and nothing else, so it cannot be used
 * here no matter how well it suits tokens.
 *
 * Best-effort in both directions. A store that will not open is a phone that
 * forgets a preference, which is a fallback rather than an error, so every
 * reader treats `null` as "never chosen" and lands on the same default a fresh
 * install gets.
 *
 * The `try` blocks cover reading and writing, not the import. `expo-sqlite` is
 * a native module: a client whose native side predates it throws on load and no
 * handler here could catch that. Expo Go bundles it; a custom dev client has to
 * be rebuilt for it, exactly as it was for `expo-secure-store`.
 */
import Storage from "expo-sqlite/kv-store";

/**
 * Namespaced so the store stays legible in a debugger and a future key cannot
 * collide with a library's.
 */
export const PREFERENCE_KEYS = {
	locale: "fairway:locale",
	appearance: "fairway:appearance",
	/** Opt-in: keep tracking position while the phone is locked during a round. */
	backgroundLocation: "fairway:background-location",
} as const;

export type PreferenceKey =
	(typeof PREFERENCE_KEYS)[keyof typeof PREFERENCE_KEYS];

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

export function clearPreference(key: PreferenceKey) {
	try {
		Storage.removeItemSync(key);
	} catch {
		// Ignored: every reader validates what it gets back anyway.
	}
}
