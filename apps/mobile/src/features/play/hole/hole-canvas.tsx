import Constants from "expo-constants";
import { Platform } from "react-native";
import type { HoleCanvasProps } from "./hole-canvas-props";
import { HoleSatellite } from "./hole-satellite";
import { HoleSchematic } from "./hole-schematic";

// Android has imagery only when the build carries a Google Maps key: without
// one the Google SDK refuses to start.
const hasSatellite =
	Platform.OS === "ios" ||
	Boolean(Constants.expoConfig?.android?.config?.googleMaps?.apiKey);

export function HoleCanvas(props: HoleCanvasProps) {
	return hasSatellite ? (
		<HoleSatellite {...props} />
	) : (
		<HoleSchematic {...props} />
	);
}
