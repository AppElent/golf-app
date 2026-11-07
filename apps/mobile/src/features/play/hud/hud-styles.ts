import { StyleSheet } from "react-native";
import { course, spacing } from "../../../theme";

export const hudTextShadow = {
	textShadowColor: course.distanceShadow,
	textShadowOffset: { width: 0, height: 1 },
	textShadowRadius: 4,
};

export const hudStyles = StyleSheet.create({
	onHud: { color: course.hudText, ...hudTextShadow },
	onHudMuted: { color: course.hudTextMuted },
	pressed: { opacity: 0.7 },
	tray: { position: "absolute", left: spacing.md, right: spacing.md },
});
