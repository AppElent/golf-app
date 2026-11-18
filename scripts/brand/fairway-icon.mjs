// Fairway app icon artwork (APP-274): one bold flag on the putting green.
// Vector source for every icon asset; `make-icons.mjs` renders it with sharp.

const palettes = {
	light: {
		bg: ["#25935a", "#0b4a2a"],
		fringe: "#5fcf8f",
		green: "#7fe0a6",
		shade: "#0b4a2a",
		cup: "#0b3a22",
		pole: "#ffffff",
		flag: "#ffd60a",
	},
	// iOS dark appearance: near-black field, the dark-mode accent for the green.
	dark: {
		bg: ["#123021", "#050d08"],
		fringe: "#2a8f59",
		green: "#3fbf7a",
		shade: "#0b2a19",
		cup: "#050d08",
		pole: "#f3f4ef",
		flag: "#ffd60a",
	},
	// iOS tinted appearance: grayscale on black; iOS maps luminance to the tint.
	tinted: {
		bg: ["#000000", "#000000"],
		fringe: "#5a5a5a",
		green: "#8a8a8a",
		shade: "#2a2a2a",
		cup: "#000000",
		pole: "#ffffff",
		flag: "#ffffff",
	},
};

const svg = (content, defs = "") =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}</defs>${content}</svg>`;

const art = (c) => `
	<ellipse cx="512" cy="770" rx="400" ry="138" fill="${c.fringe}"/>
	<ellipse cx="512" cy="760" rx="360" ry="112" fill="${c.green}"/>
	<path d="M512 752 L 820 700 L 828 716 L 520 770 Z" fill="${c.shade}" opacity="0.28"/>
	<ellipse cx="512" cy="756" rx="44" ry="16" fill="${c.cup}"/>
	<rect x="496" y="176" width="32" height="586" rx="16" fill="${c.pole}"/>
	<path d="M526 186 C 600 196, 680 222, 812 286 C 690 330, 610 368, 526 398 Z" fill="${c.flag}"/>`;

/** Full-bleed, square 1024 px icon for an iOS appearance. */
export function iconSvg(appearance) {
	const c = palettes[appearance];
	return svg(
		`<rect width="1024" height="1024" fill="url(#field)"/>${art(c)}`,
		`<linearGradient id="field" x1="0" y1="0" x2="0.85" y2="1"><stop stop-color="${c.bg[0]}"/><stop offset="1" stop-color="${c.bg[1]}"/></linearGradient>`,
	);
}

/**
 * The mark alone on a transparent canvas. On the green Android layer the pole
 * stays white; on ivory or near-black surfaces (splash, lockup) it is emerald.
 */
export function markSvg({ pole = "#ffffff" } = {}) {
	return svg(art({ ...palettes.light, pole }));
}

export const field = palettes.light.bg;
