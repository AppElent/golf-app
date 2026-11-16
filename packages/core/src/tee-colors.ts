/**
 * Tee marker colours, keyed by the colour a tee plays from. Shared by the web
 * hole map and the phone's course palette so both draw the same markers.
 */
export const TEE_MARKER_COLORS: Readonly<Record<string, string>> = {
	white: "#ffffff",
	yellow: "#ffd400",
	blue: "#2f8fff",
	red: "#ff3b30",
	orange: "#ff9500",
};

/** A tee whose colour has no marker entry. */
export const TEE_MARKER_FALLBACK = TEE_MARKER_COLORS.white;
