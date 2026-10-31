/**
 * Picks the hole renderer: satellite imagery where the platform has it (iOS
 * always; Android when the build carries a Google Maps key — without one the
 * Google SDK refuses to start), the vector schematic otherwise.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { HoleCanvasProps } from "./hole-canvas-props";
import { HoleSatellite } from "./hole-satellite";
import { HoleSchematic } from "./hole-schematic";

export const hasSatellite =
	Platform.OS === "ios" ||
	Boolean(Constants.expoConfig?.android?.config?.googleMaps?.apiKey);

export function HoleCanvas({
	mode,
	...props
}: HoleCanvasProps & { mode: "satellite" | "schematic" }) {
	return mode === "satellite" && hasSatellite ? (
		<HoleSatellite {...props} />
	) : (
		<HoleSchematic {...props} />
	);
}
