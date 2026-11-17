import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// APP-191: the app column follows the system theme through the themed colour
// tokens in styles.css. These checks keep both themes at the DESIGN_SYSTEM.md
// contrast targets and keep fixed light colours out of the shell.

const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
const classes = readFileSync(
	join(import.meta.dirname, "components/classes.ts"),
	"utf8",
);

function block(source: string, start: string): string {
	const from = source.indexOf(start);
	if (from === -1) throw new Error(`${start} not found`);
	let depth = 0;
	for (let i = source.indexOf("{", from); i < source.length; i++) {
		if (source[i] === "{") depth++;
		if (source[i] === "}" && --depth === 0) return source.slice(from, i + 1);
	}
	throw new Error(`${start} is not closed`);
}

function vars(source: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [, name, value] of source.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
		out[name] = value.trim();
	}
	return out;
}

const light = { ...vars(block(css, "@theme")), ...vars(block(css, ":root {")) };
const darkOverrides = vars(block(css, "@media (prefers-color-scheme: dark)"));
const dark = { ...light, ...darkOverrides };

type Rgba = [number, number, number, number];

function parse(value: string): Rgba {
	const hex = value.match(/^#([0-9a-f]{6})$/i);
	if (hex) {
		const n = Number.parseInt(hex[1], 16);
		return [n >> 16, (n >> 8) & 255, n & 255, 1];
	}
	const rgb = value.match(
		/^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:\s*[/,]\s*([\d.]+))?\)$/,
	);
	if (rgb) {
		return [
			Number(rgb[1]),
			Number(rgb[2]),
			Number(rgb[3]),
			Number(rgb[4] ?? 1),
		];
	}
	throw new Error(`unsupported colour ${value}`);
}

function over(top: Rgba, ground: Rgba): Rgba {
	const a = top[3];
	return [
		top[0] * a + ground[0] * (1 - a),
		top[1] * a + ground[1] * (1 - a),
		top[2] * a + ground[2] * (1 - a),
		1,
	];
}

function luminance([r, g, b]: Rgba): number {
	const lin = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: Rgba, b: Rgba): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const THEMES = { light, dark } as const;

/** A token's colour, composited over the canvas when it is translucent. */
function color(theme: Record<string, string>, token: string): Rgba {
	const value = theme[`color-${token}`];
	if (!value) throw new Error(`--color-${token} missing`);
	return over(parse(value), parse(theme["color-canvas"]));
}

/** Text tokens on the grounds they appear on. */
const TEXT = ["ink", "moss", "stone", "live-ink", "flag-ink", "pine-ink"];
const GROUNDS = ["canvas", "surface", "bar", "field"];

describe.each(Object.entries(THEMES))("%s theme", (_name, theme) => {
	for (const text of TEXT) {
		for (const ground of GROUNDS) {
			it(`${text} on ${ground} reaches 4.5:1`, () => {
				expect(
					ratio(color(theme, text), color(theme, ground)),
				).toBeGreaterThanOrEqual(4.5);
			});
		}
	}

	it("links reach 4.5:1 on the canvas and cards", () => {
		const link = parse(theme["page-link"]);
		expect(ratio(link, color(theme, "canvas"))).toBeGreaterThanOrEqual(4.5);
		expect(ratio(link, color(theme, "surface"))).toBeGreaterThanOrEqual(4.5);
	});

	it("cream text on a pine fill reaches 4.5:1", () => {
		expect(
			ratio(color(theme, "cream"), color(theme, "pine-fill")),
		).toBeGreaterThanOrEqual(4.5);
	});

	it("on-stone text on a stone fill reaches 4.5:1", () => {
		expect(
			ratio(color(theme, "on-stone"), color(theme, "stone")),
		).toBeGreaterThanOrEqual(4.5);
	});

	// Translucent tints: SyncPill (live/15, flag/15), a selected option
	// (live/10) and the selected scorecard hole (pine-ink/10).
	const TINTS = [
		["live-ink", "live", 0.15],
		["flag-ink", "flag", 0.15],
		["ink", "live", 0.1],
		// The selected hole's number and par are ink: stone misses 4.5:1 here.
		["ink", "pine-ink", 0.1],
	] as const;
	for (const [text, tint, alpha] of TINTS) {
		for (const ground of ["canvas", "surface"]) {
			it(`${text} on ${tint}/${alpha * 100} over ${ground} reaches 4.5:1`, () => {
				const [r, g, b] = color(theme, tint);
				const bg = over([r, g, b, alpha], color(theme, ground));
				expect(ratio(color(theme, text), bg)).toBeGreaterThanOrEqual(4.5);
			});
		}
	}

	it("field placeholders (stone) reach 4.5:1", () => {
		expect(classes).toMatch(/FIELD =[^;]*placeholder:text-stone/);
		expect(
			ratio(color(theme, "stone"), color(theme, "field")),
		).toBeGreaterThanOrEqual(4.5);
	});

	it("active and inactive tabs differ by at least 1.5:1", () => {
		expect(
			ratio(color(theme, "pine-ink"), color(theme, "stone")),
		).toBeGreaterThanOrEqual(1.5);
	});
});

describe("dark theme", () => {
	it("darkens the app column", () => {
		expect(luminance(color(dark, "canvas"))).toBeLessThan(0.05);
		expect(luminance(color(dark, "surface"))).toBeLessThan(0.05);
	});

	// Light mode keeps its existing field edge (APP-191: light looks
	// unchanged); see DESIGN_SYSTEM.md, Contrast.
	it("field edges reach 3:1 against the field and the ground around it", () => {
		const edge = color(dark, "control-line");
		for (const ground of ["field", "surface", "canvas"]) {
			expect(ratio(edge, color(dark, ground))).toBeGreaterThanOrEqual(3);
		}
	});

	it("leaves the brand fills and map colours alone", () => {
		for (const token of Object.keys(darkOverrides)) {
			expect(token).not.toMatch(
				/^color-(pine|pine-light|cream|flag|live|mint|mint-soft|map-.*)$/,
			);
		}
	});
});

describe("app column classes", () => {
	// Every web source file under src/, except tests and generated code.
	const files = (
		readdirSync(import.meta.dirname, { recursive: true }) as string[]
	)
		.filter((f) => /\.tsx?$/.test(f))
		.filter((f) => !f.includes(".test.") && !f.endsWith(".gen.ts"))
		.sort();

	// Fixed light colours that would stay light in dark mode. bg-pine and
	// bg-pine-light remain for the always-dark Play screen only.
	const FIXED =
		/\b(bg-cream|bg-white\/(60|90)|text-pine|ring-pine|bg-pine\/\d+|text-muted)\b(?![-\w])/;

	it.each(files)("%s uses themed tokens", (file) => {
		const source = readFileSync(join(import.meta.dirname, file), "utf8");
		expect(source).not.toMatch(FIXED);
		// A round bordered button is a control: its edge is control-line.
		expect(source).not.toMatch(/"rounded-full border border-card-line/);
	});

	it("the Play screen is the only user of bg-pine", () => {
		const users = files.filter((file) =>
			/\bbg-pine\b(?![-\w/])/.test(
				readFileSync(join(import.meta.dirname, file), "utf8"),
			),
		);
		expect(users).toEqual(["routes/play.tsx"]);
	});
});
