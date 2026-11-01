/**
 * The phone's palette, radii, spacing and type ramp.
 *
 * The contract is `designs/foundry/` (readme + `tokens/*.css`); this file is
 * its React Native transcription. CSS custom properties cascade, these do not,
 * so every value is typed out. When the two disagree, Foundry wins — fix this
 * file, not the design system. The web app adopts the same palette, so there
 * is no longer a "web look" to keep this one apart from.
 *
 * System / Light / Dark is resolved by AppearanceProvider. Static palettes are
 * used only for token definitions and UIKit trait-adaptive chrome. Components
 * read useTokens(). accentFill is the lime fill; accent and accentInk are
 * legible foreground colors in either scheme.
 */
import { type ColorValue, DynamicColorIOS, Platform } from "react-native";

/** Every colour the app is allowed to use, dark scheme. */
export const darkColors = {
	bg: "#08130d",
	surface: "#11201a",
	surface2: "#1a2c23",
	accent: "#3fbf7a",
	accentPressed: "#5fd493",
	accentDim: "rgba(63, 191, 122, 0.14)",
	onAccent: "#06110b",
	accentInk: "#7fe0a6",
	text: "#f1f5f0",
	textMuted: "#9aaa9f",
	swipeNeutral: "#7d8478",
	textFaint: "#919789",
	border: "rgba(255, 255, 255, 0.07)",
	borderStrong: "rgba(255, 255, 255, 0.14)",
	separator: "rgba(255, 255, 255, 0.14)",
	danger: "#ff6b6b",
	dangerSoft: "rgba(255, 107, 107, 0.12)",
	success: "#4ade80",
	successSoft: "rgba(74, 222, 128, 0.10)",
	warn: "#fbbf24",
	warnSoft: "rgba(251, 191, 36, 0.12)",
	warnBorder: "rgba(251, 191, 36, 0.25)",
	accentFill: "#3fbf7a",
	onDanger: "#08130d",
	scrim: "rgba(0, 0, 0, 0.6)",
	mediaScrim: "rgba(10, 11, 9, 0.72)",
	onMedia: "#ffffff",
	surfaceTransparent: "rgba(17, 32, 26, 0)",
	/** iOS settings icon tiles (DESIGN_SYSTEM.md exception); the system colours per scheme. */
	tileIndigo: "#5e5ce6",
	tileBlue: "#0a84ff",
	tileOrange: "#ff9f0a",
	tileGreen: "#30d158",
	tilePurple: "#bf5af2",
	tileTeal: "#64d2ff",
} as const;

export const colors = darkColors;

/** The light scheme — `designs/foundry/tokens/light.css`. Same keys, so a screen never branches. */
export const lightColors: Tokens = {
	bg: "#f3f4ef",
	surface: "#ffffff",
	surface2: "#e7ebe3",
	accent: "#1c7a4c",
	accentPressed: "#2e9e63",
	accentDim: "rgba(28, 122, 76, 0.10)",
	onAccent: "#ffffff",
	accentInk: "#1c6b45",
	text: "#16241c",
	textMuted: "#506157",
	swipeNeutral: "#7d8478",
	textFaint: "#606b57",
	border: "rgba(26, 32, 21, 0.12)",
	borderStrong: "rgba(26, 32, 21, 0.25)",
	separator: "rgba(60, 62, 50, 0.10)",
	danger: "#b42332",
	dangerSoft: "rgba(180, 35, 50, 0.09)",
	success: "#24723c",
	successSoft: "rgba(21, 127, 69, 0.10)",
	warn: "#865500",
	warnSoft: "rgba(134, 85, 0, 0.09)",
	warnBorder: "rgba(134, 85, 0, 0.25)",
	accentFill: "#2e9e63",
	onDanger: "#ffffff",
	scrim: "rgba(0, 0, 0, 0.4)",
	mediaScrim: "rgba(10, 11, 9, 0.72)",
	onMedia: "#ffffff",
	surfaceTransparent: "rgba(255, 255, 255, 0)",
	tileIndigo: "#5856d6",
	tileBlue: "#007aff",
	tileOrange: "#ff9500",
	tileGreen: "#34c759",
	tilePurple: "#af52de",
	tileTeal: "#5ac8fa",
};

export const colorsLight = lightColors;

/** On-course overlay palette: drawn over satellite imagery, so every value
 *  is chosen for contrast against grass, sand, water and trees rather than
 *  against the app's own surfaces. Not themed: the map looks the same in
 *  light and dark mode. */
export const course = {
	targetLine: "#ffd60a",
	target: "#ffd60a",
	onTarget: "#1a1600",
	shotLine: "#ffffff",
	distanceText: "#ffffff",
	distanceShadow: "rgba(0, 0, 0, 0.75)",
	player: "#0a84ff",
	playerHalo: "rgba(10, 132, 255, 0.22)",
	green: "#7fe0a6",
	hazardWater: "#64d2ff",
	hazardBunker: "#f5dfa0",
	flag: "#e0532f",
	measure: "#ffffff",
	ring: "rgba(255, 255, 255, 0.55)",
	/** Behind distance labels on the imagery. */
	labelFill: "rgba(0, 0, 0, 0.55)",
	/** HUD controls where Liquid Glass is unavailable (Android, iOS < 26). */
	hudFill: "rgba(14, 20, 17, 0.72)",
	hudText: "#ffffff",
	hudTextMuted: "rgba(255, 255, 255, 0.72)",
	/** Schematic (no-imagery) ground. */
	rough: "#2f5d3a",
	fairway: "#4f9a5c",
	greenFill: "#79c98a",
	tee: "#5fae6e",
	bunker: "#e9d8a6",
	water: "#3f8fbf",
	birdie: "#e0532f",
	eagle: "#e0532f",
	bogey: "#8a968d",
} as const;

export const radius = {
	xs: 4,
	sm: 6,
	md: 8,
	lg: 12,
	/** Shell rows, tiles and the inset grouped list. */
	card: 14,
	/** Content cards. */
	cardLg: 18,
	/** Nutrition diary reference: composed content summary. */
	contentCard: 24,
	sheet: 20,
	pill: 9999,
} as const;

/**
 * 4-point grid. The web's Tailwind spacing is the same grid, so the two agree
 * without either importing the other.
 */
export const spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
	xxl: 48,
} as const;

/**
 * Layout decisions shared by screens and the form design-system seam. Heights
 * are minimums, never fixed, so Dynamic Type can grow a row.
 */
export const metrics = {
	screenGutter: 20,
	formGutter: 16,
	/** iOS grouped-list row; 44 is the floor. */
	rowMinHeight: 48,
	fieldMinHeight: 44,
	hitTarget: 44,
	/** The primary capsule. */
	controlHeight: 46,
	sectionGap: 18,
	/** Hairlines start here from the leading edge, never full-bleed. */
	separatorInset: 16,
	/** A content column stops growing here so a tablet does not stretch a form. */
	formMaxWidth: 640,
} as const;

/**
 * Motion is native where possible. In-app motion is short, eased and never
 * looping — skeletons are still, so Reduce Motion needs no branch.
 */
export const motion = {
	/** cubic-bezier(0.32, 0.72, 0, 1) — the spring that settles a swiped row. */
	easeIos: [0.32, 0.72, 0, 1] as const,
	durFast: 150,
	durBase: 250,
	durSheet: 350,
} as const;

export const opacity = {
	/** Press is a colour change, not a fade; this is for the few places that must fade. */
	pressed: 0.7,
	disabled: 0.5,
} as const;

/**
 * Named text styles. Screens pick a name; nothing outside this file sets a
 * `fontSize`. No custom fonts are bundled, so weights are numeric and the
 * platform synthesises them from the system face.
 *
 * Two layers. The content ramp (`display` … `metric`) is the app's original.
 * The native layer (`largeTitle` … `control`) matches the platform's own text
 * styles; chrome and grouped lists use it so a screen reads as an app rather
 * than a page. Colours here are the dark scheme — a migrated screen overrides
 * `color` from `useTokens()`.
 */
export const type = {
	/** Opt-in Round 5 editor typography; existing consumers retain their sizes. */
	quantityCompact: { fontSize: 44, fontWeight: "600", letterSpacing: -1.76 },
	table: { fontSize: 14, fontWeight: "400" },
	quantity: { fontSize: 52, fontWeight: "600", letterSpacing: -1.5 },
	display: { fontSize: 32, fontWeight: "800" },
	title: { fontSize: 24, fontWeight: "800" },
	heading: { fontSize: 18, fontWeight: "700" },
	body: { fontSize: 15, fontWeight: "500" },
	label: { fontSize: 13, fontWeight: "600" },
	caption: { fontSize: 12, fontWeight: "500" },
	/** Dense labels inside chips and plates; never body copy. */
	micro: { fontSize: 10, fontWeight: "700" },
	/** Numbers that are the point of the screen: reps, weight, set counts. */
	metric: { fontSize: 28, fontWeight: "800" },

	/** Native iOS layer. */
	largeTitle: {
		fontSize: 34,
		fontWeight: "700",
		letterSpacing: -0.8,
	},
	navTitle: { fontSize: 17, fontWeight: "600" },
	/** A grouped-list row title. */
	row: {
		fontSize: 17,
		fontWeight: "600",
		letterSpacing: -0.2,
	},
	/** The line under a row title, or a right-aligned value. */
	secondary: { fontSize: 15, fontWeight: "400" },
	/** Section footers, field errors, timestamps. */
	footnote: { fontSize: 13, fontWeight: "400" },
	/** Text inside a button or segmented control. */
	control: { fontSize: 16, fontWeight: "600" },
} as const;

/**
 * A colour that UIKit resolves itself, per trait, with no JS round-trip.
 * Android has no equivalent and follows `useTokens()` instead.
 */
function dynamic(dark: string, light: string): ColorValue {
	return Platform.OS === "ios" ? DynamicColorIOS({ dark, light }) : dark;
}

/**
 * Colours for native chrome — the tab bar, stack headers, large titles.
 *
 * On iOS 26 Liquid Glass decides the tab bar's trait on its own from the
 * content under it — even in a dev build with `userInterfaceStyle` baked into
 * Info.plist the bar comes up light for a moment. A static hex is therefore
 * wrong half the time (a lime icon on light glass). These resolve on the UIKit
 * side, so the bar is legible whichever way it flips, and they are the reason
 * `accentInk` has a light value at all. Stack headers do NOT use these: their
 * trait resolves light while the ground is dark, so they take the static
 * scheme colours (see `coach-tab-stack.tsx`). Content never uses these
 * either; content reads `useTokens()`.
 */
export const chrome = {
	bg: dynamic(colors.bg, colorsLight.bg),
	text: dynamic(colors.text, colorsLight.text),
	textMuted: dynamic(colors.textMuted, colorsLight.textMuted),
	accentInk: dynamic(colors.accentInk, colorsLight.accentInk),
} as const;

export type Scheme = "dark" | "light";
export type Tokens = { readonly [K in keyof typeof darkColors]: string };
