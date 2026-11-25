import { StyleSheet, View } from "react-native";
import { type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";
import { CIRCLE_FONT_SCALE } from "./round-button";

/** A player's initial in a circle; the name is always beside it. */
export function PlayerAvatar({
	name,
	initial = ([...name.trim()][0] ?? "?").toUpperCase(),
	size,
}: {
	name: string;
	/** Shown instead of the first letter, for a team. */
	initial?: string;
	size: number;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
			style={[
				styles.circle,
				{ width: size, height: size, borderRadius: size / 2 },
			]}
		>
			<AppText
				variant="label"
				maxFontSizeMultiplier={CIRCLE_FONT_SCALE}
				style={styles.initial}
			>
				{initial}
			</AppText>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		circle: {
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.accentDim,
		},
		initial: { color: colors.accentInk, fontWeight: "700" },
	});
