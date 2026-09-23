# Offline Safety Net & PWA Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make in-round scoring survive a dead zone — score writes buffer to `localStorage`, overlay optimistically, and flush to Convex with retry when connectivity returns — and make the app installable as a PWA.

**Architecture:** A pure queue module (`scoreQueue`) over injectable storage holds pending score writes, merged per `(round, hole, player)` so sequential offline edits accumulate into one last-write-wins patch. A `useScoreSync` hook wraps the existing `rounds.setScore` mutation: it enqueues, exposes a pending overlay for the UI, and flushes on submit / `online` / interval. The scorecard routes all writes through it and merges the overlay onto server scores, showing a sync pill. A branded manifest + a minimal network-first service worker deliver installability without a full offline-first engine.

**Tech Stack:** TanStack Start (React 19), Convex (`useMutation`), `localStorage`, Web App Manifest + Service Worker, Vitest, Biome (tabs + double quotes). Package manager: **pnpm**.

**Build-order context:** This is step 7 of spec §10 (`docs/superpowers/specs/2026-07-08-golf-companion-v1-design.md`): "Offline safety net (mutation buffer) + PWA install polish." Spec §5 defines the mutation buffer ("score writes apply optimistically to UI + localStorage queue, flush to Convex with backoff when online; 'syncing' pill when queue non-empty") and §8 the dead-zone behaviour. Scoring, `rounds.setScore`, and the scorecard already exist (Plan 3); this plan changes only *how* score writes reach Convex, plus adds PWA assets. It deliberately does **not** build a full offline-first sync engine (spec §2 locked "online-first + safety net").

**Conventions (match existing code):**
- Biome: **tabs**, **double quotes**, semicolons. `pnpm lint:fix` before each commit. Stable data-derived React keys (no array index).
- Pure modules under `src/` have zero framework imports and Vitest tests; hooks live under `src/hooks/` and `src/offline/`.
- SSR safety: `localStorage` / `navigator` only exist on the client — guard every access with `typeof window !== "undefined"`. The app SSRs via TanStack Start, so any module imported by a route must not touch browser globals at import time (only inside effects/handlers).
- The scorecard is `src/routes/card.tsx`; it reads the active round via `useQuery(api.rounds.active)` and currently writes with `useMutation(api.rounds.setScore)` through a local `patch(fields)` helper.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/offline/scoreQueue.ts` | Pure localStorage-backed queue: read/write/enqueue(merge)/remove + key helpers. |
| `src/offline/scoreQueue.test.ts` | Unit tests with an in-memory fake storage. |
| `src/hooks/useOnlineStatus.ts` | `navigator.onLine` + online/offline event subscription. |
| `src/offline/useScoreSync.ts` | Hook: enqueue + flush `rounds.setScore`; exposes overlay, count, syncing. |
| `src/routes/card.tsx` | Route writes through the buffer; overlays pending; shows the sync pill. |
| `src/components/SyncPill.tsx` | Small pill: "Offline" / "Syncing n" / hidden when idle. |
| `public/manifest.json` | Fairway-branded web app manifest. |
| `public/sw.js` | Minimal network-first service worker (installability). |
| `src/components/ServiceWorker.tsx` | Client-only registrar (returns null). |
| `src/routes/__root.tsx` | Head: manifest link + theme-color; body: mount the registrar. |

---

## Task 1: `scoreQueue` pure module (TDD)

**Files:**
- Create: `src/offline/scoreQueue.ts`
- Test: `src/offline/scoreQueue.test.ts`

The queue holds one entry per `(roundId, holeIndex, playerIndex)`. Enqueuing **merges** fields into any existing entry for that key, so an offline "set strokes" then "set putts" on the same hole becomes a single patch — matching how the server's `setScore` merges sequential writes (last-write-wins per spec §8).

- [ ] **Step 1: Write failing tests**

Create `src/offline/scoreQueue.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
	enqueueScore,
	keyFor,
	keyOf,
	readQueue,
	removeEntry,
	type ScoreEntry,
	type StorageLike,
} from "./scoreQueue";

function fakeStorage(): StorageLike {
	const map = new Map<string, string>();
	return {
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => {
			map.set(k, v);
		},
	};
}

const entry = (over: Partial<ScoreEntry> = {}): ScoreEntry => ({
	roundId: "r1",
	holeIndex: 0,
	playerIndex: 0,
	fields: { strokes: 4 },
	...over,
});

describe("scoreQueue", () => {
	let storage: StorageLike;
	beforeEach(() => {
		storage = fakeStorage();
	});

	it("reads an empty queue when nothing is stored", () => {
		expect(readQueue(storage)).toEqual([]);
	});

	it("reads an empty queue when the stored value is corrupt", () => {
		storage.setItem("fairway.scoreQueue", "{not json");
		expect(readQueue(storage)).toEqual([]);
	});

	it("appends a new entry", () => {
		enqueueScore(storage, entry());
		const q = readQueue(storage);
		expect(q).toHaveLength(1);
		expect(q[0].fields).toEqual({ strokes: 4 });
	});

	it("merges fields into the existing entry for the same key", () => {
		enqueueScore(storage, entry({ fields: { strokes: 4 } }));
		enqueueScore(storage, entry({ fields: { putts: 2 } }));
		const q = readQueue(storage);
		expect(q).toHaveLength(1);
		expect(q[0].fields).toEqual({ strokes: 4, putts: 2 });
	});

	it("keeps distinct keys separate", () => {
		enqueueScore(storage, entry({ holeIndex: 0 }));
		enqueueScore(storage, entry({ holeIndex: 1 }));
		expect(readQueue(storage)).toHaveLength(2);
	});

	it("removes an entry by key", () => {
		enqueueScore(storage, entry());
		removeEntry(storage, keyOf(entry()));
		expect(readQueue(storage)).toEqual([]);
	});

	it("builds a stable composite key", () => {
		expect(keyFor("r1", 3, 2)).toBe("r1:3:2");
		expect(keyOf(entry({ holeIndex: 3, playerIndex: 2 }))).toBe("r1:3:2");
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/offline/scoreQueue.test.ts`
Expected: FAIL — `./scoreQueue` not found.

- [ ] **Step 3: Implement**

Create `src/offline/scoreQueue.ts`:

```ts
export interface ScoreFields {
	strokes?: number;
	putts?: number;
	fir?: boolean;
	gir?: boolean;
	penalties?: number;
	nr?: boolean;
}

export interface ScoreEntry {
	roundId: string;
	holeIndex: number;
	playerIndex: number;
	fields: ScoreFields;
}

/** Minimal storage surface — real `localStorage` or a test fake. */
export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

const QUEUE_KEY = "fairway.scoreQueue";

export function keyFor(
	roundId: string,
	holeIndex: number,
	playerIndex: number,
): string {
	return `${roundId}:${holeIndex}:${playerIndex}`;
}

export function keyOf(entry: ScoreEntry): string {
	return keyFor(entry.roundId, entry.holeIndex, entry.playerIndex);
}

export function readQueue(storage: StorageLike): ScoreEntry[] {
	const raw = storage.getItem(QUEUE_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as ScoreEntry[]) : [];
	} catch {
		return [];
	}
}

function writeQueue(storage: StorageLike, entries: ScoreEntry[]): void {
	storage.setItem(QUEUE_KEY, JSON.stringify(entries));
}

/** Add or merge an entry; merged fields accumulate for the same key. */
export function enqueueScore(
	storage: StorageLike,
	entry: ScoreEntry,
): ScoreEntry[] {
	const queue = readQueue(storage);
	const key = keyOf(entry);
	const existing = queue.find((e) => keyOf(e) === key);
	if (existing) {
		existing.fields = { ...existing.fields, ...entry.fields };
	} else {
		queue.push(entry);
	}
	writeQueue(storage, queue);
	return queue;
}

export function removeEntry(storage: StorageLike, key: string): ScoreEntry[] {
	const queue = readQueue(storage).filter((e) => keyOf(e) !== key);
	writeQueue(storage, queue);
	return queue;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/offline/scoreQueue.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm check && pnpm typecheck
git add src/offline/scoreQueue.ts src/offline/scoreQueue.test.ts
git commit -m "feat(offline): localStorage score queue with merge-per-hole"
```

---

## Task 2: `useOnlineStatus` hook

**Files:**
- Create: `src/hooks/useOnlineStatus.ts`

- [ ] **Step 1: Implement**

Create `src/hooks/useOnlineStatus.ts`:

```ts
import { useEffect, useState } from "react";

/** Live online/offline flag. SSR-safe: assumes online until mounted. */
export function useOnlineStatus(): boolean {
	const [online, setOnline] = useState(true);

	useEffect(() => {
		if (typeof navigator === "undefined") return;
		const update = () => setOnline(navigator.onLine);
		update();
		window.addEventListener("online", update);
		window.addEventListener("offline", update);
		return () => {
			window.removeEventListener("online", update);
			window.removeEventListener("offline", update);
		};
	}, []);

	return online;
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm check
git add src/hooks/useOnlineStatus.ts
git commit -m "feat(hooks): useOnlineStatus"
```

---

## Task 3: `useScoreSync` hook

**Files:**
- Create: `src/offline/useScoreSync.ts`

Wraps `rounds.setScore`. `submit` enqueues + flushes; `pending` is the overlay map (key → merged fields) the scorecard reads to show unsynced edits; `flush` drains the queue oldest-first, stopping on the first failure and retrying on the next `online`/interval tick.

- [ ] **Step 1: Implement**

Create `src/offline/useScoreSync.ts`:

```ts
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
	enqueueScore,
	keyOf,
	readQueue,
	removeEntry,
	type ScoreEntry,
	type ScoreFields,
	type StorageLike,
} from "./scoreQueue";

const FLUSH_INTERVAL_MS = 15000;

function storage(): StorageLike | null {
	if (typeof window === "undefined") return null;
	return window.localStorage;
}

function overlayFrom(store: StorageLike | null): Map<string, ScoreFields> {
	const map = new Map<string, ScoreFields>();
	if (!store) return map;
	for (const entry of readQueue(store)) map.set(keyOf(entry), entry.fields);
	return map;
}

export interface ScoreSync {
	submit: (entry: ScoreEntry) => void;
	pending: Map<string, ScoreFields>;
	pendingCount: number;
	syncing: boolean;
}

export function useScoreSync(): ScoreSync {
	const setScore = useMutation(api.rounds.setScore);
	const online = useOnlineStatus();
	const [pending, setPending] = useState<Map<string, ScoreFields>>(() =>
		overlayFrom(storage()),
	);
	const [syncing, setSyncing] = useState(false);
	const flushing = useRef(false);

	const refresh = useCallback(() => setPending(overlayFrom(storage())), []);

	const flush = useCallback(async () => {
		const store = storage();
		if (!store || flushing.current) return;
		if (typeof navigator !== "undefined" && !navigator.onLine) return;
		flushing.current = true;
		setSyncing(true);
		try {
			for (const entry of readQueue(store)) {
				try {
					await setScore({
						roundId: entry.roundId as Id<"rounds">,
						holeIndex: entry.holeIndex,
						playerIndex: entry.playerIndex,
						...entry.fields,
					});
					removeEntry(store, keyOf(entry));
					refresh();
				} catch {
					// Network/permission failure — leave the rest queued, retry later.
					break;
				}
			}
		} finally {
			flushing.current = false;
			setSyncing(false);
		}
	}, [setScore, refresh]);

	const submit = useCallback(
		(entry: ScoreEntry) => {
			const store = storage();
			if (!store) return;
			enqueueScore(store, entry);
			refresh();
			void flush();
		},
		[flush, refresh],
	);

	// Flush when connectivity returns.
	useEffect(() => {
		if (online) void flush();
	}, [online, flush]);

	// Periodic retry while anything is queued.
	useEffect(() => {
		const id = setInterval(() => {
			if (pending.size > 0) void flush();
		}, FLUSH_INTERVAL_MS);
		return () => clearInterval(id);
	}, [flush, pending.size]);

	return { submit, pending, pendingCount: pending.size, syncing };
}
```

> Note on the `roundId as Id<"rounds">` cast: `ScoreEntry.roundId` is a plain `string` (the queue is framework-free and serialisable), but `setScore` wants a branded `Id<"rounds">`. The cast bridges the pure-module boundary; the value is always a real round id supplied by the scorecard. Keep `ScoreEntry.roundId` a `string` — do not brand the queue type.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm check
git add src/offline/useScoreSync.ts
git commit -m "feat(offline): useScoreSync — buffered setScore with flush + overlay"
```

---

## Task 4: `SyncPill` + wire the scorecard

**Files:**
- Create: `src/components/SyncPill.tsx`
- Modify: `src/routes/card.tsx`

- [ ] **Step 1: SyncPill component**

Create `src/components/SyncPill.tsx`:

```tsx
/** Compact status pill for the scorecard: offline / syncing / hidden. */
export function SyncPill({
	online,
	pendingCount,
	syncing,
}: {
	online: boolean;
	pendingCount: number;
	syncing: boolean;
}) {
	if (online && pendingCount === 0) return null;
	const label = !online
		? `Offline · ${pendingCount} queued`
		: syncing
			? `Syncing ${pendingCount}…`
			: `${pendingCount} to sync`;
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-[11px] font-semibold ${
				online ? "bg-live/15 text-live" : "bg-flag/15 text-flag"
			}`}
		>
			<span
				className={`size-1.5 rounded-full ${online ? "bg-live" : "bg-flag"}`}
			/>
			{label}
		</span>
	);
}
```

- [ ] **Step 2: Wire imports + hooks into `card.tsx`**

In `src/routes/card.tsx`, update the imports. Add these lines to the existing import block (keep everything else):

```tsx
import { SyncPill } from "../components/SyncPill";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useScoreSync } from "../offline/useScoreSync";
import { keyFor } from "../offline/scoreQueue";
```

Then **remove** the direct mutation line:

```tsx
const setScore = useMutation(api.rounds.setScore);
```

and replace it with the buffered hook + online flag:

```tsx
const { submit, pending, pendingCount, syncing } = useScoreSync();
const online = useOnlineStatus();
```

`useMutation` is still used for `finish` and `abandon`, so leave the `useMutation` import in place.

- [ ] **Step 3: Overlay pending edits onto server scores**

In `card.tsx`, find the `scoreOf` definition (it currently reads only from the query's `scores`):

```tsx
const scoreOf = (holeIndex: number, pIdx: number) =>
	scores.find((s) => s.holeIndex === holeIndex && s.playerIndex === pIdx);
```

Replace it with a version that merges the pending overlay on top of the server record, so every existing reader (grid, `strokesFor`, `selScore`, the editor) reflects unsynced edits:

```tsx
const scoreOf = (holeIndex: number, pIdx: number) => {
	const server = scores.find(
		(s) => s.holeIndex === holeIndex && s.playerIndex === pIdx,
	);
	const overlay = pending.get(keyFor(round._id, holeIndex, pIdx));
	if (!server && !overlay) return undefined;
	return { ...(server ?? {}), ...(overlay ?? {}) };
};
```

- [ ] **Step 4: Route writes through the buffer**

Find the `patch` helper:

```tsx
const patch = (fields: Record<string, number | boolean | undefined>) =>
	setScore({
		roundId: round._id,
		holeIndex: selected,
		playerIndex,
		...fields,
	});
```

Replace it with a buffered submit:

```tsx
const patch = (fields: {
	strokes?: number;
	putts?: number;
	fir?: boolean;
	gir?: boolean;
	penalties?: number;
	nr?: boolean;
}) =>
	submit({
		roundId: round._id,
		holeIndex: selected,
		playerIndex,
		fields,
	});
```

No call sites change — `patch({ strokes, nr: false })`, `patch({ putts })`, `patch({ fir })`, etc. all still type-check against the explicit field shape.

- [ ] **Step 5: Show the pill in the header**

Find the scorecard header:

```tsx
<header className="flex items-baseline justify-between">
	<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
		{course.name}
	</h1>
	<span className="text-[12px] text-moss">{round.loopLabel}</span>
</header>
```

Replace the trailing `<span>` with a stack that includes the pill:

```tsx
<header className="flex items-baseline justify-between">
	<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
		{course.name}
	</h1>
	<div className="flex flex-col items-end gap-1">
		<span className="text-[12px] text-moss">{round.loopLabel}</span>
		<SyncPill online={online} pendingCount={pendingCount} syncing={syncing} />
	</div>
</header>
```

- [ ] **Step 6: Route-gen, typecheck, lint, build**

Run: `pnpm generate-routes && pnpm typecheck && pnpm lint:fix && pnpm check && pnpm build`
Expected: all exit 0. If Biome flags the `roundId` cast in `useScoreSync`, adjust per Task 3's note.

- [ ] **Step 7: Commit**

```bash
git add src/components/SyncPill.tsx src/routes/card.tsx
git commit -m "feat(offline): scorecard writes through the buffer + sync pill"
```

---

## Task 5: PWA manifest

**Files:**
- Modify: `public/manifest.json`
- Modify: `src/routes/__root.tsx`

The scaffold `public/manifest.json` still says "TanStack App". Rebrand it and link it from the document head with a theme color.

- [ ] **Step 1: Rebrand the manifest**

Replace the entire contents of `public/manifest.json`:

```json
{
	"name": "Fairway — Golf Companion",
	"short_name": "Fairway",
	"description": "Track your golf rounds and get a GPS caddie on the course.",
	"start_url": "/",
	"scope": "/",
	"display": "standalone",
	"orientation": "portrait",
	"background_color": "#F3EFE4",
	"theme_color": "#0F3D2A",
	"icons": [
		{
			"src": "/logo192.png",
			"type": "image/png",
			"sizes": "192x192",
			"purpose": "any maskable"
		},
		{
			"src": "/logo512.png",
			"type": "image/png",
			"sizes": "512x512",
			"purpose": "any maskable"
		}
	]
}
```

> The `logo192.png` / `logo512.png` files exist from the scaffold. Replacing them with Fairway-branded icons is visual polish flagged for the field-test pass; the manifest is fully valid and installable with the current files.

- [ ] **Step 2: Link the manifest + theme color from the head**

In `src/routes/__root.tsx`, the `Route` head config currently is:

```tsx
head: () => ({
	meta: [
		{ charSet: "utf-8" },
		{
			name: "viewport",
			content: "width=device-width, initial-scale=1, viewport-fit=cover",
		},
		{ title: "Fairway · Golf Companion" },
	],
	links: [{ rel: "stylesheet", href: appCss }],
}),
```

Add a theme-color meta and a manifest link:

```tsx
head: () => ({
	meta: [
		{ charSet: "utf-8" },
		{
			name: "viewport",
			content: "width=device-width, initial-scale=1, viewport-fit=cover",
		},
		{ name: "theme-color", content: "#0F3D2A" },
		{ title: "Fairway · Golf Companion" },
	],
	links: [
		{ rel: "stylesheet", href: appCss },
		{ rel: "manifest", href: "/manifest.json" },
		{ rel: "apple-touch-icon", href: "/logo192.png" },
	],
}),
```

- [ ] **Step 3: Typecheck, build, commit**

Run: `pnpm typecheck && pnpm build`
Expected: exit 0. In the built `dist/`, the manifest link and theme-color are present in the SSR HTML.

```bash
pnpm lint:fix && pnpm check
git add public/manifest.json src/routes/__root.tsx
git commit -m "feat(pwa): Fairway manifest + theme-color + manifest link"
```

---

## Task 6: Service worker + registration

**Files:**
- Create: `public/sw.js`
- Create: `src/components/ServiceWorker.tsx`
- Modify: `src/routes/__root.tsx`

A minimal **network-first** service worker: it satisfies installability and caches successfully-fetched same-origin GETs as a fallback, but always prefers the network so it never serves stale app routes. Offline *scoring* is handled by the mutation buffer, not the SW (spec §5).

- [ ] **Step 1: Service worker script**

Create `public/sw.js`:

```js
const CACHE = "fairway-v1";

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
		return;
	}
	event.respondWith(
		(async () => {
			try {
				const response = await fetch(request);
				if (response && response.ok) {
					const cache = await caches.open(CACHE);
					cache.put(request, response.clone());
				}
				return response;
			} catch {
				const cached = await caches.match(request);
				if (cached) return cached;
				throw new Error("offline and not cached");
			}
		})(),
	);
});
```

- [ ] **Step 2: Client-only registrar**

Create `src/components/ServiceWorker.tsx`:

```tsx
import { useEffect } from "react";

/** Registers the service worker on the client. Renders nothing. */
export function ServiceWorker() {
	useEffect(() => {
		if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
			return;
		}
		navigator.serviceWorker.register("/sw.js").catch(() => {
			// Registration failures are non-fatal — the app works without the SW.
		});
	}, []);
	return null;
}
```

- [ ] **Step 3: Mount the registrar in the shell**

In `src/routes/__root.tsx`, add the import:

```tsx
import { ServiceWorker } from "../components/ServiceWorker";
```

Then render it inside the app tree (place it just after the `<BottomNav />` line in `RootDocument`):

```tsx
<BottomNav />
<ServiceWorker />
```

- [ ] **Step 4: Typecheck, build, commit**

Run: `pnpm typecheck && pnpm lint:fix && pnpm check && pnpm build`
Expected: all exit 0. (`public/sw.js` is plain JS served at `/sw.js`; it is not part of the module graph, so tsc/biome don't type it — that's expected.)

```bash
git add public/sw.js src/components/ServiceWorker.tsx src/routes/__root.tsx
git commit -m "feat(pwa): minimal network-first service worker + registration"
```

---

## Task 7: Full verification gate + browser QA

**Files:** none (verification only)

- [ ] **Step 1: Regenerate + drift check**

Run: `pnpm exec convex codegen && pnpm generate-routes && git status --short`
Expected: no unexpected drift (commit any with a `chore:` message).

- [ ] **Step 2: Four gates**

- `pnpm check` → exit 0
- `pnpm typecheck` → exit 0
- `pnpm test` → all suites pass (previous plans + `scoreQueue`)
- `pnpm build` → exit 0

- [ ] **Step 3: Browser QA (offline buffer + PWA)**

Launch `preview_start({name:"All (dev:watch)"})`. Ensure an active round exists (start one via `/rounds/new` if the Plan 4 round was finished). Drive with `javascript_tool` per the `golf-app-verification-infra` memory.

1. **Online write still works:** open `/card`, set a hole's strokes (via the Strokes stepper `+`). Assert the grid cell shows the value and the pill is hidden (online, queue empty). Confirm the write reached Convex: `pnpm exec convex run rounds:active '{}'` shows the score.
2. **Simulated offline buffering:** in the page, force offline and stub the mutation path by dispatching the offline event and setting `navigator.onLine`:
   ```js
   Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true });
   window.dispatchEvent(new Event("offline"));
   ```
   Then set a different hole's strokes. Assert: the grid cell updates optimistically (overlay), the **SyncPill** appears reading "Offline · 1 queued", and `localStorage.getItem("fairway.scoreQueue")` contains the entry.
3. **Flush on reconnect:** restore online and fire the event:
   ```js
   Object.defineProperty(navigator, "onLine", { get: () => true, configurable: true });
   window.dispatchEvent(new Event("online"));
   ```
   Assert the pill disappears within a couple of seconds and `localStorage.getItem("fairway.scoreQueue")` is `"[]"` or `null`. Confirm the buffered score persisted: `pnpm exec convex run rounds:active '{}'` now includes it.
   > Note: the in-page `navigator.onLine` override changes what the app's `useOnlineStatus`/flush guard sees; the Convex socket itself stays connected in the preview, which is why the flush succeeds on "reconnect". This exercises the buffer/overlay/pill logic. True radio-off offline is validated in the on-course field test (spec §10 step 8).
4. **PWA installability:** reload `/`, then check:
   ```js
   JSON.stringify({
     manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href"),
     theme: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
     sw: "serviceWorker" in navigator && !!(await navigator.serviceWorker.getRegistration()),
   })
   ```
   Assert `manifest` is `/manifest.json`, `theme` is `#0F3D2A`, and `sw` is `true`. Fetch `/manifest.json` and confirm `name` is "Fairway — Golf Companion".

Capture the `localStorage` queue transitions and the manifest/SW check output as proof.

- [ ] **Step 4: Secrets scan + wrap**

Run: `git log --oneline` over the plan range + `git status`; confirm no `.env*`, keys, or tokens staged. (The buffer and SW need no secrets.)

---

## Self-review checklist (run after execution)

1. **Spec §5 mutation buffer** — optimistic UI overlay ✓, localStorage queue ✓, flush with retry when online ✓, syncing pill when queue non-empty ✓.
2. **Spec §8 dead zone** — buffered writes ✓; course data + geometry stay local **in-session** via Convex's client cache (GPS distances need no network) ✓. **Deferral:** reload-while-offline geometry rehydration from localStorage is a field-test enhancement (see Known deferrals) — §10 step 7 scopes this step to the "mutation buffer," which is delivered.
3. **Spec §8 last-write-wins** — single scorer; queue merges per `(round, hole, player)`, and `setScore` patches server-side, so the merged flush equals the sequential-write result ✓.
4. **Spec §5 PWA** — manifest (installable, branded, theme color) ✓ + minimal service worker for installability, offline logic kept in the buffer not the SW ✓.
5. **SSR safety** — every `localStorage`/`navigator` access is guarded (`typeof window`/`typeof navigator`); pure `scoreQueue` takes injected storage ✓.
6. **Type consistency** — `ScoreEntry`/`ScoreFields`/`StorageLike`/`keyFor`/`keyOf` identical across `scoreQueue`, `useScoreSync`, and `card.tsx`; the `card.tsx` `patch` field shape matches `ScoreFields` ✓.
7. **No placeholders / no secrets / stable keys** ✓.

## Known deferrals (carried forward)

- **Reload-offline geometry cache** — the active round's course geometry is held in-session by Convex's client cache, which covers a dead zone during play. Rehydrating it from `localStorage` after a *full reload while offline* is deferred to the Welderen field test (spec §10 step 8), where real radio-off conditions can validate it.
- **True offline flush validation** — browser QA simulates offline via a `navigator.onLine` override (the Convex socket stays up in the preview). Radio-off behaviour is a field-test item.
- **Branded PWA icons** — `logo192.png` / `logo512.png` are still the scaffold art; swap for Fairway icons in the polish pass.
- **Background sync** — flush is foreground (submit / `online` / interval). A Background Sync API registration could flush after the tab closes; not needed for v1's "safety net."
- **Global sync indicator** — the pill lives on the scorecard (where scores are entered). A shell-level indicator can be added if other surfaces gain buffered writes.
```
