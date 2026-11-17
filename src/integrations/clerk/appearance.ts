import { useSyncExternalStore } from "react";

const DARK = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
	const query = window.matchMedia(DARK);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

/** Whether the system asks for dark mode. False on the server. */
export function usePrefersDark(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => window.matchMedia(DARK).matches,
		() => false,
	);
}

/**
 * Clerk's sign-in card in dark mode, drawn from the app column's themed
 * tokens (styles.css). Light mode keeps Clerk's own look, so no appearance is
 * passed there. Clerk accepts CSS variables here and derives its shades from
 * them; e2e/dark-theme.spec.ts checks the dark card after a Clerk upgrade.
 */
export const DARK_APPEARANCE = {
	variables: {
		colorBackground: "var(--color-surface)",
		colorForeground: "var(--color-ink)",
		colorMutedForeground: "var(--color-moss)",
		colorNeutral: "var(--color-ink)",
		colorInput: "var(--color-field)",
		colorInputForeground: "var(--color-ink)",
		colorBorder: "var(--color-control-line)",
		colorPrimary: "var(--color-pine-fill)",
		colorPrimaryForeground: "var(--color-cream)",
		colorDanger: "var(--color-flag-ink)",
	},
};
