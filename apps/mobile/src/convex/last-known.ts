/**
 * Layer 2 of the `last-known` flavor: a disposable copy of a few query results
 * on this phone, in the one key-value store (`expo-sqlite/kv-store`, the same
 * synchronous store `prefs/local-preference.ts` uses). Standard:
 * `docs/standards/convex-query-caching.md`.
 *
 * It is a copy, never the data. Every key names the bundle, the account, the
 * function and its arguments, so new code never reads an old shape and one
 * account never reads another's. Every failure (no store, a throw, a value
 * that will not parse) is a miss: the caller waits for Convex exactly as it
 * would with no copy. There are no tables, schemas or migrations to keep.
 *
 * Beside the entries sits one marker: the account Convex last confirmed on
 * this phone. The offline fallback only reads a copy for the account Clerk
 * restored locally when it matches that marker. Confirmed sign-out deletes the
 * marker and every entry together (`clearLastKnown`).
 *
 * What persists is decided in `query-cache.tsx`, not here.
 */
import { convexToJson, jsonToConvex, type Value } from "convex/values";
import Storage from "expo-sqlite/kv-store";
import * as Updates from "expo-updates";

const PREFIX = "qc|";
const MARKER = `${PREFIX}confirmed-account`;
/**
 * Values above this many characters are not written. A course with all its
 * hole geometry is the largest value (the biggest catalog course is ~300k).
 * Recorded in `CODING_STANDARDS.md`.
 */
export const MAX_VALUE_LENGTH = 1_000_000;
/** At most this many entries; recorded in `CODING_STANDARDS.md`. */
export const MAX_ENTRIES = 50;

let bundle: string | undefined;
/**
 * The JS bundle this code shipped in: the native runtime (a fingerprint, so a
 * new native build changes it) plus the over-the-air update id. A copy written
 * by any other bundle is never read.
 */
export function bundleVersion(): string {
	if (bundle === undefined) {
		try {
			bundle = `${Updates.runtimeVersion ?? "dev"}+${Updates.updateId ?? "embedded"}`;
		} catch {
			bundle = "unknown";
		}
	}
	return bundle;
}

/** The key prefix for one account's entries in this bundle. */
export function diskScope(account: string, version = bundleVersion()) {
	return `${PREFIX}${JSON.stringify([version, account])}|`;
}

/** The entry key for one query in a scope, or undefined if it cannot be made. */
export function entryKey(scope: string, name: string, args: Value) {
	try {
		return `${scope}${name}|${JSON.stringify(convexToJson(args))}`;
	} catch {
		return undefined;
	}
}

function cacheKeys(): string[] {
	return Storage.getAllKeysSync().filter((key: string) =>
		key.startsWith(PREFIX),
	);
}

export function readEntry(key: string): Value | undefined {
	try {
		const raw = Storage.getItemSync(key);
		return raw === null ? undefined : jsonToConvex(JSON.parse(raw));
	} catch {
		return undefined;
	}
}

/** The value last written per key in this process, so several readers of
 *  one live answer write it once (values of one subscription share a
 *  reference). Forgotten whenever entries are deleted. */
const lastWritten = new Map<string, unknown>();

/** `writeEntry`, unless this exact value was the last one written here. */
export function writeEntryOnce(key: string, value: Value) {
	if (Object.is(lastWritten.get(key), value)) return;
	lastWritten.set(key, value);
	writeEntry(key, value);
}

/** The play screen's round outlives any eviction: the offline view needs it. */
const isPinned = (key: string) => key.includes("|rounds:active|");

export function writeEntry(key: string, value: Value) {
	try {
		const raw = JSON.stringify(convexToJson(value));
		if (raw.length > MAX_VALUE_LENGTH) {
			Storage.removeItemSync(key);
			return;
		}
		const others = cacheKeys().filter(
			(k) => k !== key && k !== MARKER && !isPinned(k),
		);
		// Any eviction will do for a disposable copy; no LRU bookkeeping.
		for (const old of others.slice(
			0,
			Math.max(0, others.length - MAX_ENTRIES + 1),
		))
			Storage.removeItemSync(old);
		// A screen still mounted during sign-out can write after the clear. That
		// entry is unreadable offline (the marker is gone), and the clear on
		// confirmed sign-out, or the next account's confirmation, removes it.
		Storage.setItemSync(key, raw);
	} catch {
		// A miss next time, nothing worse.
	}
}

/**
 * Convex has confirmed `account` on this phone: remember it, and delete every
 * entry from another account or bundle.
 */
export function confirmAccount(account: string) {
	try {
		lastWritten.clear();
		const keep = diskScope(account);
		for (const key of cacheKeys())
			if (key !== MARKER && !key.startsWith(keep)) Storage.removeItemSync(key);
		Storage.setItemSync(MARKER, account);
	} catch {
		// Without the marker the offline fallback shows nothing; that is allowed.
	}
}

/** The account Convex last confirmed here, or null. */
export function confirmedAccount(): string | null {
	try {
		return Storage.getItemSync(MARKER);
	} catch {
		return null;
	}
}

/** Confirmed sign-out: delete the marker and every entry. */
export function clearLastKnown() {
	lastWritten.clear();
	try {
		for (const key of cacheKeys()) Storage.removeItemSync(key);
	} catch {
		// Nothing more can be done; the next confirmation prunes again.
	}
}

/**
 * The stored value of one query for an account in this bundle, for the
 * offline fallback. Only when `account` is the one Convex last confirmed here;
 * otherwise, and on any failure, undefined.
 */
export function readOfflineEntry(
	account: string,
	name: string,
	args: Value,
): Value | undefined {
	try {
		if (confirmedAccount() !== account) return undefined;
		const key = entryKey(diskScope(account), name, args);
		return key ? readEntry(key) : undefined;
	} catch {
		return undefined;
	}
}
