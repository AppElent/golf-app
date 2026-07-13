# Fairway Foundation (Plan 1 of 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the scaffold demo code, install the Fairway design system + app shell (bottom nav, 5 screen routes), and build the four pure domain modules (scoring, handicap, geo, club-suggest) with dense tests.

**Architecture:** This is phase 1–2 of the build order in `docs/superpowers/specs/2026-07-08-golf-companion-v1-design.md` (read §3 for the design system and §5 for the domain module contracts — they are the source of truth). Domain logic lives in `src/domain/` as pure TypeScript with zero framework imports. UI tokens are Tailwind v4 `@theme` variables in `src/styles.css`. Later plans (course data, rounds/scorecard, Play map, stats screens, offline buffer) build on these exact APIs.

**Tech Stack:** TanStack Start (React 19, file-based routes), Tailwind v4, Vitest, Biome (tabs, double quotes), pnpm (never npm/yarn). Windows dev machine — but all commands below run in Git Bash syntax via the Bash tool.

**Conventions for every task:** run `pnpm lint:fix` before each commit so Biome formatting (tabs, double quotes) is always clean. Never edit `src/routeTree.gen.ts` by hand — run `pnpm generate-routes` after adding/removing route files.

---

## Follow-up plans (not in this document)

Plan 2: Convex schema + course import (OSM/Overpass + GolfCourseAPI) + course editor + seed Welderen & De Oosterhoutse · Plan 3: round setup + scorecard · Plan 4: Play screen (map pipeline, polished SVG, GPS, ladder/aim/club chip) · Plan 5: Home/Progress/Profile with real data · Plan 6: offline mutation buffer + PWA. Each gets written when its phase starts.

---

### Task 1: Delete scaffold demo code

The scaffold ships demo routes (MCP todos, forms, Clerk/Convex demos), a starter Header/Footer, and demo Convex tables. All of it goes. This also fixes the two known pre-existing `pnpm typecheck` failures (unused imports in `src/router.tsx`, untyped body in the demo MCP route).

**Files:**
- Delete: `src/routes/demo/` (entire directory — 7 files)
- Delete: `src/routes/mcp.ts`, `src/routes/about.tsx`
- Delete: `src/components/Header.tsx`, `src/components/Footer.tsx`, `src/components/ThemeToggle.tsx`, `src/components/demo.FormComponents.tsx`
- Delete: `src/hooks/demo.form.ts`, `src/hooks/demo.form-context.ts`
- Delete: `src/mcp-todos.ts`, `src/utils/mcp-handler.ts`
- Delete: `src/integrations/clerk/header-user.tsx`
- Delete: `convex/todos.ts`
- Modify: `convex/schema.ts`, `src/router.tsx`, `src/routes/__root.tsx`, `package.json` (via pnpm)

- [ ] **Step 1: Delete the files**

```bash
git rm -r src/routes/demo
git rm src/routes/mcp.ts src/routes/about.tsx
git rm src/components/Header.tsx src/components/Footer.tsx src/components/ThemeToggle.tsx src/components/demo.FormComponents.tsx
git rm src/hooks/demo.form.ts src/hooks/demo.form-context.ts
git rm src/mcp-todos.ts src/utils/mcp-handler.ts
git rm src/integrations/clerk/header-user.tsx
git rm convex/todos.ts
```

- [ ] **Step 2: Empty the Convex schema**

Replace the full contents of `convex/schema.ts` with:

```ts
import { defineSchema } from "convex/server";

export default defineSchema({});
```

- [ ] **Step 3: Fix `src/router.tsx` unused imports**

Replace the full contents of `src/router.tsx` with:

```ts
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "./integrations/tanstack-query/root-provider";

export function getRouter() {
	const context = getContext();

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});

	setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
```

- [ ] **Step 4: Strip Header/Footer from the root route**

In `src/routes/__root.tsx`: remove the two import lines for `Footer` and `Header`, and remove the `<Header />` and `<Footer />` JSX elements (children stays). Leave everything else (providers, devtools, `THEME_INIT_SCRIPT`) untouched — Task 4 rewrites this file properly.

- [ ] **Step 5: Remove now-orphaned dependencies**

`@modelcontextprotocol/sdk` was only used by the deleted MCP demo; `@tanstack/react-form` only by the deleted form demos.

```bash
pnpm remove @modelcontextprotocol/sdk @tanstack/react-form
```

- [ ] **Step 6: Regenerate the route tree and verify**

```bash
pnpm generate-routes
pnpm typecheck
pnpm test
```

Expected: `generate-routes` rewrites `src/routeTree.gen.ts` without the deleted routes; `typecheck` exits 0 (this is the first time it passes on this repo); `test` exits 0 (passWithNoTests).

- [ ] **Step 7: Commit**

```bash
pnpm lint:fix
git add -A
git commit -m "chore: remove scaffold demo code, fix pre-existing typecheck errors"
```

---

### Task 2: Repo-wide Biome reformat

The scaffold code uses single quotes/no semicolons; `biome.json` wants tabs + double quotes (~60 pre-existing `pnpm check` errors). With the demo code gone, reformat what's left so `pnpm check` is clean from here on.

**Files:**
- Modify: everything Biome touches under `src/` (mechanical)

- [ ] **Step 1: Auto-fix**

```bash
pnpm lint:fix
pnpm check
```

Expected: `check` exits 0. If any errors remain they'll be lint (not format) findings — typical case is an unused variable or import in a surviving file; delete the unused symbol and re-run until clean. Do not disable rules.

- [ ] **Step 2: Verify nothing broke, then commit**

```bash
pnpm typecheck
pnpm test
git add -A
git commit -m "style: apply biome formatting repo-wide"
```

---

### Task 3: Fairway design tokens + fonts

Spec §3 defines the palette/type. Install them as Tailwind v4 `@theme` tokens so `bg-cream`, `text-ink`, `font-display` etc. work everywhere. `src/styles.css` is excluded from Biome — don't worry about its formatting.

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Swap the font import**

In `src/styles.css`, replace line 1 (the Fraunces/Manrope Google Fonts `@import url(...)`) with:

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
```

- [ ] **Step 2: Add the Fairway token block**

Immediately after the `@custom-variant dark (&:is(.dark *));` line, insert:

```css
/* ── Fairway design tokens (spec §3) ─────────────────────────── */
@theme {
	/* surfaces & lines */
	--color-cream: #f3efe4;
	--color-cream-line: #efe9da;
	--color-card-line: #e9e2d2;
	/* greens */
	--color-pine: #0f3d2a;
	--color-pine-light: #144d34;
	--color-fern: #1c6b45;
	--color-live: #2e9e63;
	--color-mint: #7fe0a6;
	--color-mint-soft: #9fc7ae;
	/* accents & ink */
	--color-flag: #e0532f;
	--color-ink: #16241c;
	--color-moss: #5e6e64;
	--color-stone: #8a968d;
	--color-sand: #eadfb8;
	--color-water: #8fbfd0;
	/* map layers (used by the Play plan) */
	--color-map-rough: #8fa86b;
	--color-map-semi: #a9c07e;
	--color-map-fairway: #c6da9c;
	--color-map-green: #6fc188;
	--color-map-green-edge: #4fa76c;
	/* type */
	--font-sans: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
}
```

Leave the existing `:root` oklch variables in place — the shadcn `src/components/ui/*` components consume them and they don't conflict.

- [ ] **Step 3: Verify and commit**

```bash
pnpm build
git add src/styles.css
git commit -m "feat: add Fairway design tokens and fonts"
```

Expected: build exits 0 (tokens are validated by usage in Task 4).

---

### Task 4: App shell — bottom nav, root frame, five screens

The Fairway shell: a centered max-width mobile frame, the 5-tab bottom nav from the comp, and one route file per surface. Home gets a static Fairway-styled placeholder (real data arrives in Plan 5); Play/Card/Progress/Profile get styled placeholders. This is the first visible Fairway screen — verify it in the browser preview.

**Files:**
- Create: `src/components/BottomNav.tsx`
- Create: `src/routes/play.tsx`, `src/routes/card.tsx`, `src/routes/progress.tsx`, `src/routes/profile.tsx`
- Modify: `src/routes/__root.tsx`, `src/routes/index.tsx`

- [ ] **Step 1: Create `src/components/BottomNav.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import {
	ChartLine,
	CircleUserRound,
	ClipboardList,
	House,
	LandPlot,
} from "lucide-react";

const tabs = [
	{ to: "/", label: "Home", icon: House },
	{ to: "/play", label: "Play", icon: LandPlot },
	{ to: "/card", label: "Card", icon: ClipboardList },
	{ to: "/progress", label: "Progress", icon: ChartLine },
	{ to: "/profile", label: "Profile", icon: CircleUserRound },
] as const;

export default function BottomNav() {
	return (
		<nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[86px] w-full max-w-[430px] items-start border-t border-card-line bg-white/90 px-2 pt-3 backdrop-blur-md">
			{tabs.map(({ to, label, icon: Icon }) => (
				<Link
					key={to}
					to={to}
					activeOptions={{ exact: to === "/" }}
					className="flex flex-1 flex-col items-center gap-1"
					activeProps={{ className: "text-pine" }}
					inactiveProps={{ className: "text-stone" }}
				>
					<Icon size={23} strokeWidth={1.9} />
					<span className="text-[10.5px] font-semibold">{label}</span>
				</Link>
			))}
		</nav>
	);
}
```

- [ ] **Step 2: Rewrite `src/routes/__root.tsx`**

Replace the full contents with:

```tsx
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import BottomNav from "../components/BottomNav";
import ClerkProvider from "../integrations/clerk/provider";
import ConvexProvider from "../integrations/convex/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";

import { THEME_INIT_SCRIPT } from "@appelent/auth";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
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
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="bg-[#233028] font-sans antialiased">
				<ClerkProvider>
					<ConvexProvider>
						<div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-cream shadow-2xl">
							{children}
						</div>
						<BottomNav />
						<TanStackDevtools
							config={{ position: "bottom-right" }}
							plugins={[
								{
									name: "Tanstack Router",
									render: <TanStackRouterDevtoolsPanel />,
								},
								TanStackQueryDevtools,
							]}
						/>
					</ConvexProvider>
				</ClerkProvider>
				<Scripts />
			</body>
		</html>
	);
}
```

The dark `#233028` body backdrop frames the cream app column on desktop; on phones the column is full-width. Every screen must end with `pb-[110px]` so content clears the fixed nav.

- [ ] **Step 3: Rewrite `src/routes/index.tsx` (Home placeholder)**

Replace the full contents with:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: HomeScreen });

function HomeScreen() {
	return (
		<main className="px-5 pt-16 pb-[110px]">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<p className="text-[13px] font-medium text-moss">Welcome to</p>
					<h1 className="font-display text-[22px] font-bold tracking-tight text-ink">
						Fairway
					</h1>
				</div>
				<Link
					to="/profile"
					className="flex h-11 w-11 items-center justify-center rounded-full bg-pine font-display text-base font-bold text-cream"
				>
					EJ
				</Link>
			</div>

			<section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-pine-light to-pine p-6 text-[#eaf2e9] shadow-[0_18px_40px_-22px_rgba(15,61,42,0.9)]">
				<div className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full bg-live/15" />
				<p className="text-[12.5px] font-semibold tracking-[0.14em] uppercase opacity-70">
					Handicap Index
				</p>
				<p className="mt-1 font-display text-[56px] leading-none font-bold tracking-tight">
					—
				</p>
				<p className="mt-2 text-[12.5px] opacity-65">
					Play your first round to start the trend
				</p>
			</section>

			<Link
				to="/play"
				className="mt-4 flex items-center justify-between rounded-[22px] bg-flag px-6 py-4 shadow-[0_14px_30px_-16px_rgba(224,83,47,0.9)]"
			>
				<span>
					<span className="block font-display text-lg font-bold text-white">
						Start a round
					</span>
					<span className="block text-[13px] text-white/80">
						Course setup coming soon
					</span>
				</span>
				<span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/18 text-white">
					→
				</span>
			</Link>
		</main>
	);
}
```

- [ ] **Step 4: Create the four placeholder screens**

`src/routes/play.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/play")({ component: PlayScreen });

function PlayScreen() {
	return (
		<main className="min-h-dvh bg-pine px-5 pt-16 pb-[110px] text-[#eaf2e9]">
			<p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
				Play
			</p>
			<h1 className="mt-1 font-display text-[22px] font-bold">
				GPS caddie
			</h1>
			<div className="mt-6 rounded-[22px] bg-white/7 p-6 text-sm text-mint-soft">
				The hole map, distances and club suggestions arrive with the Play
				plan. Until then this screen is a placeholder.
			</div>
		</main>
	);
}
```

`src/routes/card.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/card")({ component: CardScreen });

function CardScreen() {
	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Scorecard
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				Hole-by-hole scoring arrives with the rounds plan.
			</p>
		</main>
	);
}
```

`src/routes/progress.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/progress")({
	component: ProgressScreen,
});

function ProgressScreen() {
	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Progress
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				Handicap trend and stats arrive once rounds are stored.
			</p>
		</main>
	);
}
```

`src/routes/profile.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
	component: ProfileScreen,
});

function ProfileScreen() {
	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Profile
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				Settings and club bag management arrive in a later plan.
			</p>
		</main>
	);
}
```

- [ ] **Step 5: Regenerate routes, typecheck**

```bash
pnpm generate-routes
pnpm typecheck
```

Expected: both exit 0.

- [ ] **Step 6: Verify in the browser preview**

Start the dev server via the preview tooling (`.claude/launch.json` has the config; use `preview_start`, never a raw shell). Then:

1. `preview_snapshot` — expect the Home screen: "Fairway" heading, handicap hero with "—", orange "Start a round" block, bottom nav with 5 tabs.
2. Click each tab (`preview_click` on the nav links) and snapshot — each placeholder screen renders, active tab turns dark green, Play screen has the dark pine background.
3. `preview_console_logs` with level `error` — expect none (Clerk/Convex warnings about missing env are acceptable if the dev `.env.local` isn't loaded; anything React/render-related is not).
4. `preview_screenshot` — visually compare against the comp's Home: cream bg, deep-green hero card, orange CTA, correct fonts (numerals in Space Grotesk).

Fix anything off before proceeding.

- [ ] **Step 7: Commit**

```bash
pnpm lint:fix
git add -A
git commit -m "feat: Fairway app shell with bottom nav and five screen routes"
```

---

### Task 5: `scoring` domain module (TDD)

Pure functions for stroke play + Stableford. Spec §5/§8: playing-handicap strokes fall on holes by stroke index; NR or empty holes score 0 Stableford points; vs-par only counts played holes.

**Files:**
- Create: `src/domain/scoring.ts`
- Test: `src/domain/scoring.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/scoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	formatVsPar,
	stablefordPoints,
	strokesReceived,
	totalStrokes,
	vsPar,
} from "./scoring";

describe("strokesReceived", () => {
	it("gives one stroke on the lowest-SI holes for a single-digit handicap", () => {
		expect(strokesReceived(1, 11)).toBe(1);
		expect(strokesReceived(11, 11)).toBe(1);
		expect(strokesReceived(12, 11)).toBe(0);
		expect(strokesReceived(18, 11)).toBe(0);
	});

	it("gives a stroke on every hole plus extras when handicap exceeds 18", () => {
		expect(strokesReceived(6, 24)).toBe(2); // 24 % 18 = 6 → SI 1..6 get 2
		expect(strokesReceived(7, 24)).toBe(1);
		expect(strokesReceived(18, 24)).toBe(1);
	});

	it("gives no strokes at scratch", () => {
		expect(strokesReceived(1, 0)).toBe(0);
	});

	it("takes strokes back on the highest-SI holes for plus handicaps", () => {
		expect(strokesReceived(18, -2)).toBe(-1);
		expect(strokesReceived(17, -2)).toBe(-1);
		expect(strokesReceived(16, -2)).toBe(0);
	});
});

describe("stablefordPoints", () => {
	const par4si10 = { par: 4, strokeIndex: 10 };

	it("scores the standard table at scratch", () => {
		expect(stablefordPoints(par4si10, 2, 0)).toBe(4); // eagle
		expect(stablefordPoints(par4si10, 3, 0)).toBe(3); // birdie
		expect(stablefordPoints(par4si10, 4, 0)).toBe(2); // par
		expect(stablefordPoints(par4si10, 5, 0)).toBe(1); // bogey
		expect(stablefordPoints(par4si10, 6, 0)).toBe(0); // double
		expect(stablefordPoints(par4si10, 9, 0)).toBe(0); // never negative
	});

	it("applies received strokes via stroke index", () => {
		const par4si1 = { par: 4, strokeIndex: 1 };
		expect(stablefordPoints(par4si1, 5, 11)).toBe(2); // net par
		expect(stablefordPoints(par4si10, 5, 11)).toBe(2); // SI 10 also inside 11
		const par4si12 = { par: 4, strokeIndex: 12 };
		expect(stablefordPoints(par4si12, 5, 11)).toBe(1); // no stroke here
	});

	it("scores 0 for a hole not played (null / NR)", () => {
		expect(stablefordPoints(par4si10, null, 11)).toBe(0);
	});
});

describe("totals", () => {
	it("sums strokes ignoring unplayed holes", () => {
		expect(totalStrokes([4, 5, null, 3])).toBe(12);
	});

	it("computes vs-par over played holes only", () => {
		const holes = [{ par: 4 }, { par: 3 }, { par: 5 }];
		expect(vsPar(holes, [5, 3, null])).toBe(1);
		expect(vsPar(holes, [4, 3, 5])).toBe(0);
	});

	it("formats vs-par golf style", () => {
		expect(formatVsPar(0)).toBe("E");
		expect(formatVsPar(3)).toBe("+3");
		expect(formatVsPar(-2)).toBe("-2");
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm exec vitest run src/domain/scoring.test.ts
```

Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 3: Implement `src/domain/scoring.ts`**

```ts
export interface HoleInfo {
	number: number;
	par: number;
	strokeIndex: number;
}

/**
 * WHS stroke allocation: positive playing handicaps receive strokes starting
 * at stroke index 1; plus (negative) handicaps give strokes back starting at
 * stroke index 18.
 */
export function strokesReceived(
	strokeIndex: number,
	playingHandicap: number,
): number {
	if (playingHandicap >= 0) {
		const base = Math.floor(playingHandicap / 18);
		const extra = strokeIndex <= playingHandicap % 18 ? 1 : 0;
		return base + extra;
	}
	const plus = Math.abs(playingHandicap);
	const base = Math.floor(plus / 18);
	const extra = strokeIndex > 18 - (plus % 18) ? 1 : 0;
	const total = base + extra;
	return total === 0 ? 0 : -total; // avoid returning -0 (fails toBe(0))
}

/** null strokes = hole not played / picked up → 0 points. */
export function stablefordPoints(
	hole: Pick<HoleInfo, "par" | "strokeIndex">,
	strokes: number | null,
	playingHandicap: number,
): number {
	if (strokes === null) return 0;
	const received = strokesReceived(hole.strokeIndex, playingHandicap);
	return Math.max(0, 2 + hole.par + received - strokes);
}

export function totalStrokes(strokes: ReadonlyArray<number | null>): number {
	return strokes.reduce<number>((total, s) => total + (s ?? 0), 0);
}

export function vsPar(
	holes: ReadonlyArray<Pick<HoleInfo, "par">>,
	strokes: ReadonlyArray<number | null>,
): number {
	return holes.reduce((total, hole, i) => {
		const s = strokes[i];
		return s == null ? total : total + (s - hole.par);
	}, 0);
}

export function formatVsPar(diff: number): string {
	if (diff === 0) return "E";
	return diff > 0 ? `+${diff}` : `${diff}`;
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm exec vitest run src/domain/scoring.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix
git add src/domain/scoring.ts src/domain/scoring.test.ts
git commit -m "feat: scoring domain module (stableford, stroke allocation, totals)"
```

---

### Task 6: `handicap` domain module (TDD)

WHS math from spec §5: course handicap, playing handicap, adjusted gross score (net-double-bogey cap), score differential, and the "would-be" index with the WHS small-sample table.

**Files:**
- Create: `src/domain/handicap.ts`
- Test: `src/domain/handicap.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/handicap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	adjustedGrossScore,
	courseHandicap,
	playingHandicap,
	scoreDifferential,
	wouldBeIndex,
} from "./handicap";

describe("courseHandicap / playingHandicap", () => {
	it("applies the WHS formula HI × slope/113 + (CR − par)", () => {
		// 11.5 × 132/113 + (72.1 − 72) = 13.53…
		expect(courseHandicap(11.5, 132, 72.1, 72)).toBeCloseTo(13.53, 1);
	});

	it("rounds playing handicap to the nearest integer", () => {
		expect(playingHandicap(11.5, 132, 72.1, 72)).toBe(14);
	});

	it("supports an allowance factor", () => {
		// 13.53… × 0.95 = 12.86… → 13
		expect(playingHandicap(11.5, 132, 72.1, 72, 0.95)).toBe(13);
	});
});

describe("adjustedGrossScore", () => {
	const holes = [
		{ par: 4, strokeIndex: 10 },
		{ par: 3, strokeIndex: 18 },
	];

	it("caps each hole at net double bogey", () => {
		// scratch: caps are par+2 → 6 and 5
		expect(adjustedGrossScore(holes, [9, 4], 0)).toBe(10); // 9 capped to 6
	});

	it("raises the cap by strokes received", () => {
		// ph 10 → SI 10 gets a stroke (cap 7), SI 18 does not (cap 5)
		expect(adjustedGrossScore(holes, [7, 9], 10)).toBe(12); // 7 + 5
	});
});

describe("scoreDifferential", () => {
	it("computes (113/slope) × (AGS − CR) to one decimal", () => {
		expect(scoreDifferential(82, 72.1, 132)).toBeCloseTo(8.5, 5);
	});
});

describe("wouldBeIndex", () => {
	it("returns null with fewer than 3 differentials", () => {
		expect(wouldBeIndex([8.5, 10.1])).toBeNull();
	});

	it("uses lowest 1 minus 2.0 at exactly 3 differentials", () => {
		expect(wouldBeIndex([8.5, 10.2, 12.0])).toBeCloseTo(6.5, 5);
	});

	it("uses average of lowest 2 minus 1.0 at 6 differentials", () => {
		// lowest two: 8 and 9 → avg 8.5 − 1.0 = 7.5
		expect(wouldBeIndex([12, 9, 14, 8, 11, 10])).toBeCloseTo(7.5, 5);
	});

	it("averages the best 8 of the most recent 20", () => {
		const diffs = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
		expect(wouldBeIndex(diffs)).toBeCloseTo(4.5, 5); // avg of 1..8
	});

	it("only looks at the most recent 20", () => {
		const old = [0, 0, 0, 0, 0];
		const recent = Array.from({ length: 20 }, (_, i) => i + 1);
		expect(wouldBeIndex([...old, ...recent])).toBeCloseTo(4.5, 5);
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm exec vitest run src/domain/handicap.test.ts
```

Expected: FAIL — cannot resolve `./handicap`.

- [ ] **Step 3: Implement `src/domain/handicap.ts`**

```ts
import { strokesReceived } from "./scoring";

export function courseHandicap(
	handicapIndex: number,
	slopeRating: number,
	courseRating: number,
	par: number,
): number {
	return handicapIndex * (slopeRating / 113) + (courseRating - par);
}

export function playingHandicap(
	handicapIndex: number,
	slopeRating: number,
	courseRating: number,
	par: number,
	allowance = 1,
): number {
	return Math.round(
		courseHandicap(handicapIndex, slopeRating, courseRating, par) * allowance,
	);
}

/**
 * WHS adjusted gross score: every hole capped at net double bogey
 * (par + 2 + strokes received). Callers must pass fully played rounds —
 * rounds containing NR holes don't produce a differential (spec §8).
 */
export function adjustedGrossScore(
	holes: ReadonlyArray<{ par: number; strokeIndex: number }>,
	strokes: ReadonlyArray<number>,
	playingHcp: number,
): number {
	return holes.reduce((total, hole, i) => {
		const cap = hole.par + 2 + strokesReceived(hole.strokeIndex, playingHcp);
		return total + Math.min(strokes[i], cap);
	}, 0);
}

export function scoreDifferential(
	adjustedGross: number,
	courseRating: number,
	slopeRating: number,
): number {
	const raw = (113 / slopeRating) * (adjustedGross - courseRating);
	return Math.round(raw * 10) / 10;
}

/** WHS small-sample table: how many differentials count + adjustment. */
const SMALL_SAMPLE: Record<number, { count: number; adjustment: number }> = {
	3: { count: 1, adjustment: -2 },
	4: { count: 1, adjustment: -1 },
	5: { count: 1, adjustment: 0 },
	6: { count: 2, adjustment: -1 },
	7: { count: 2, adjustment: 0 },
	8: { count: 2, adjustment: 0 },
	9: { count: 3, adjustment: 0 },
	10: { count: 3, adjustment: 0 },
	11: { count: 3, adjustment: 0 },
	12: { count: 4, adjustment: 0 },
	13: { count: 4, adjustment: 0 },
	14: { count: 4, adjustment: 0 },
	15: { count: 5, adjustment: 0 },
	16: { count: 5, adjustment: 0 },
	17: { count: 6, adjustment: 0 },
	18: { count: 6, adjustment: 0 },
	19: { count: 7, adjustment: 0 },
};

/**
 * "Would-be" handicap index from chronological differentials (oldest first).
 * Not an official index — official handicaps stay with the NGF (spec §2).
 */
export function wouldBeIndex(
	differentials: ReadonlyArray<number>,
): number | null {
	if (differentials.length < 3) return null;
	const recent = differentials.slice(-20);
	const { count, adjustment } =
		recent.length >= 20
			? { count: 8, adjustment: 0 }
			: SMALL_SAMPLE[recent.length];
	const best = [...recent].sort((a, b) => a - b).slice(0, count);
	const avg = best.reduce((total, d) => total + d, 0) / count;
	return Math.round((avg + adjustment) * 10) / 10;
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm exec vitest run src/domain/handicap.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix
git add src/domain/handicap.ts src/domain/handicap.test.ts
git commit -m "feat: handicap domain module (WHS course handicap, differentials, would-be index)"
```

---

### Task 7: `geo` domain module (TDD)

Distance math from spec §5: haversine, local-meter projection, green front/center/back (nearest/centroid/farthest of the green polygon from the player), hazard reach/carry. Tests use synthetic coordinates where the expected values are hand-computable: 0.001° of latitude ≈ 111.19 m everywhere; 0.001° of longitude ≈ 111.19 × cos(lat) m.

**Files:**
- Create: `src/domain/geo.ts`
- Test: `src/domain/geo.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/geo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	carryDistances,
	distancesToGreen,
	haversineMeters,
	polygonCentroid,
	projectToLocal,
} from "./geo";

describe("haversineMeters", () => {
	it("measures 0.001° latitude as ~111.2 m", () => {
		expect(
			haversineMeters({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 }),
		).toBeCloseTo(111.2, 0);
	});

	it("scales longitude by cos(latitude) — ~68.5 m at 52°N", () => {
		expect(
			haversineMeters({ lat: 52, lng: 5.8 }, { lat: 52, lng: 5.801 }),
		).toBeCloseTo(68.5, 0);
	});

	it("is zero for identical points", () => {
		expect(haversineMeters({ lat: 52, lng: 5.8 }, { lat: 52, lng: 5.8 })).toBe(
			0,
		);
	});
});

describe("projectToLocal", () => {
	it("returns meters east (x) and north (y) of the origin", () => {
		const origin = { lat: 52, lng: 5.8 };
		const north = projectToLocal(origin, { lat: 52.001, lng: 5.8 });
		expect(north.x).toBeCloseTo(0, 1);
		expect(north.y).toBeCloseTo(111.2, 0);
		const east = projectToLocal(origin, { lat: 52, lng: 5.801 });
		expect(east.x).toBeCloseTo(68.5, 0);
		expect(east.y).toBeCloseTo(0, 1);
	});
});

describe("polygonCentroid", () => {
	it("averages the vertices", () => {
		const centroid = polygonCentroid([
			{ lat: 0, lng: 0 },
			{ lat: 0.002, lng: 0 },
			{ lat: 0.001, lng: 0.003 },
		]);
		expect(centroid.lat).toBeCloseTo(0.001, 6);
		expect(centroid.lng).toBeCloseTo(0.001, 6);
	});
});

describe("distancesToGreen", () => {
	// Player at the origin; green vertices strung along the equator
	// at 0.0009°, 0.001°, 0.0011° longitude → 100.1 m / 111.2 m / 122.3 m.
	const player = { lat: 0, lng: 0 };
	const green = [
		{ lat: 0, lng: 0.0009 },
		{ lat: 0, lng: 0.001 },
		{ lat: 0, lng: 0.0011 },
	];

	it("front = nearest vertex, back = farthest, center = centroid", () => {
		const d = distancesToGreen(player, green);
		expect(d.front).toBeCloseTo(100.1, 0);
		expect(d.center).toBeCloseTo(111.2, 0);
		expect(d.back).toBeCloseTo(122.3, 0);
	});
});

describe("carryDistances", () => {
	it("reach = nearest edge, carry = far edge", () => {
		const player = { lat: 0, lng: 0 };
		const water = [
			{ lat: 0, lng: 0.0005 },
			{ lat: 0, lng: 0.0007 },
		];
		const d = carryDistances(player, water);
		expect(d.reach).toBeCloseTo(55.6, 0);
		expect(d.carry).toBeCloseTo(77.8, 0);
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm exec vitest run src/domain/geo.test.ts
```

Expected: FAIL — cannot resolve `./geo`.

- [ ] **Step 3: Implement `src/domain/geo.ts`**

```ts
export interface LatLng {
	lat: number;
	lng: number;
}

const EARTH_RADIUS_M = 6371000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const sinLat = Math.sin(dLat / 2);
	const sinLng = Math.sin(dLng / 2);
	const h =
		sinLat * sinLat +
		Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Equirectangular projection to a local meter grid around `origin`
 * (x = meters east, y = meters north). Accurate to well under a meter at
 * golf-hole scale; this is the layer a satellite underlay would share (spec §6).
 */
export function projectToLocal(
	origin: LatLng,
	point: LatLng,
): { x: number; y: number } {
	const x =
		toRad(point.lng - origin.lng) * Math.cos(toRad(origin.lat)) * EARTH_RADIUS_M;
	const y = toRad(point.lat - origin.lat) * EARTH_RADIUS_M;
	return { x, y };
}

/** Vertex average — adequate for compact convex-ish golf features. */
export function polygonCentroid(points: ReadonlyArray<LatLng>): LatLng {
	const lat = points.reduce((total, p) => total + p.lat, 0) / points.length;
	const lng = points.reduce((total, p) => total + p.lng, 0) / points.length;
	return { lat, lng };
}

export function distancesToGreen(
	position: LatLng,
	green: ReadonlyArray<LatLng>,
): { front: number; center: number; back: number } {
	const vertexDistances = green.map((p) => haversineMeters(position, p));
	return {
		front: Math.min(...vertexDistances),
		center: haversineMeters(position, polygonCentroid(green)),
		back: Math.max(...vertexDistances),
	};
}

export function carryDistances(
	position: LatLng,
	hazard: ReadonlyArray<LatLng>,
): { reach: number; carry: number } {
	const vertexDistances = hazard.map((p) => haversineMeters(position, p));
	return {
		reach: Math.min(...vertexDistances),
		carry: Math.max(...vertexDistances),
	};
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm exec vitest run src/domain/geo.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix
git add src/domain/geo.ts src/domain/geo.test.ts
git commit -m "feat: geo domain module (haversine, local projection, green/hazard distances)"
```

---

### Task 8: `club-suggest` domain module (TDD)

Spec §5: nearest club from the bag by carry distance; on a tie prefer the longer club (being long beats being short into trouble short of the green).

**Files:**
- Create: `src/domain/club-suggest.ts`
- Test: `src/domain/club-suggest.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/club-suggest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { suggestClub } from "./club-suggest";

const bag = [
	{ name: "Driver", carryMeters: 220 },
	{ name: "5i", carryMeters: 170 },
	{ name: "7i", carryMeters: 150 },
	{ name: "PW", carryMeters: 110 },
];

describe("suggestClub", () => {
	it("picks the club with carry nearest the target", () => {
		expect(suggestClub(bag, 148)?.name).toBe("7i");
		expect(suggestClub(bag, 200)?.name).toBe("Driver");
	});

	it("prefers the longer club on an exact tie", () => {
		expect(suggestClub(bag, 160)?.name).toBe("5i"); // 10 short of 5i, 10 past 7i
	});

	it("returns null for an empty bag", () => {
		expect(suggestClub([], 150)).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm exec vitest run src/domain/club-suggest.test.ts
```

Expected: FAIL — cannot resolve `./club-suggest`.

- [ ] **Step 3: Implement `src/domain/club-suggest.ts`**

```ts
export interface Club {
	name: string;
	carryMeters: number;
}

export function suggestClub(
	clubs: ReadonlyArray<Club>,
	targetMeters: number,
): Club | null {
	if (clubs.length === 0) return null;
	return clubs.reduce((best, club) => {
		const diff = Math.abs(club.carryMeters - targetMeters);
		const bestDiff = Math.abs(best.carryMeters - targetMeters);
		if (diff < bestDiff) return club;
		if (diff === bestDiff && club.carryMeters > best.carryMeters) return club;
		return best;
	});
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm exec vitest run src/domain/club-suggest.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix
git add src/domain/club-suggest.ts src/domain/club-suggest.test.ts
git commit -m "feat: club suggestion domain module"
```

---

### Task 9: Full-suite verification

**Files:** none new — this is the gate.

- [ ] **Step 1: Run everything**

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

Expected: all four exit 0, with the full domain test suite (4 files) green.

- [ ] **Step 2: Exercise the shell end-to-end**

Re-run the Task 4 Step 6 browser-preview walkthrough (all 5 tabs, no console errors, screenshot). This is the spec §9 flow-verification requirement for this phase.

- [ ] **Step 3: Commit any stragglers**

```bash
git status
```

If lint:fix or verification produced changes: `git add -A && git commit -m "chore: plan-1 verification fixes"`. Otherwise done — Plan 2 (course data) is next.
