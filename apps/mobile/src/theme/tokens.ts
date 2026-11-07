/**
 * The phone's palette, radii, spacing and type ramp.
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
	warn: "#fbbf24",
	warnSoft: "rgba(251, 191, 36, 0.12)",
	warnBorder: "rgba(251, 191, 36, 0.25)",
	accentFill: "#3fbf7a",
	onDanger: "#08130d",
	scrim: "rgba(0, 0, 0, 0.6)",
	/** The system orange per scheme. */
	eagle: "#ff9f0a",
} as const;

/** The light scheme. Same keys, so a screen never branches. */
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
	warn: "#865500",
	warnSoft: "rgba(134, 85, 0, 0.09)",
	warnBorder: "rgba(134, 85, 0, 0.25)",
	accentFill: "#2e9e63",
	onDanger: "#ffffff",
	scrim: "rgba(0, 0, 0, 0.4)",
	eagle: "#ff9500",
};

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
	flag: "#e0532f",
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
	/** Hazards drawn over the imagery: visible, without hiding what's under. */
	waterOverlay: "rgba(63, 143, 191, 0.4)",
	bunkerOverlay: "rgba(233, 216, 166, 0.45)",
	/** Tee markers, by the color a tee plays from. */
	teeMarker: {
		white: "#ffffff",
		yellow: "#ffd400",
		blue: "#2f8fff",
		red: "#ff3b30",
		orange: "#ff9500",
	} as Record<string, string>,
	birdie: "#e0532f",
} as const;

export const radius = {
	sm: 6,
	md: 8,
	lg: 12,
	/** Shell rows, tiles and the inset grouped list. */
	card: 14,
	/** Content cards. */
	cardLg: 18,
	/** A composed content summary and the inset grouped list. */
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
	sectionGap: 18,
	/** Hairlines start here from the leading edge, never full-bleed. */
	separatorInset: 16,
} as const;

/**
 * Named text styles. Screens pick a name and never set a `fontSize`; only the
 * controls in `ui/form.tsx` size their own text. No custom fonts are bundled,
 * so weights are numeric and the platform synthesises them from the system
 * face.
 *
 * Two layers. The content ramp (`display` … `metric`) is the app's original.
 * The native layer (`row` … `control`) matches the platform's own text
 * styles; chrome and grouped lists use it so a screen reads as an app rather
 * than a page. Colours are not part of a style: they come from `useTokens()`.
 */
export const type = {
	quantity: { fontSize: 52, fontWeight: "600", letterSpacing: -1.5 },
	display: { fontSize: 32, fontWeight: "800" },
	title: { fontSize: 24, fontWeight: "800" },
	heading: { fontSize: 18, fontWeight: "700" },
	body: { fontSize: 15, fontWeight: "500" },
	label: { fontSize: 13, fontWeight: "600" },
	caption: { fontSize: 12, fontWeight: "500" },
	/** Dense labels inside chips and plates; never body copy. */
	micro: { fontSize: 10, fontWeight: "700" },
	/** Numbers that are the point of the screen. */
	metric: { fontSize: 28, fontWeight: "800" },

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
 * scheme colours. Content never uses these either; content reads `useTokens()`.
 */
export const chrome = {
	textMuted: dynamic(darkColors.textMuted, lightColors.textMuted),
	accentInk: dynamic(darkColors.accentInk, lightColors.accentInk),
} as const;

export type Tokens = { readonly [K in keyof typeof darkColors]: string };
