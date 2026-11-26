import { StyleSheet, View } from "react-native";
import { useAnnounceChange } from "../../../feedback/announce";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { AppText } from "../../../ui/text";
import type { GameBox } from "./game-text";

/** Where the game stands; announced when it changes. */
export function StandingBox({ title, sub }: GameBox) {
	return <Box title={title} sub={sub} look="standing" />;
}

/** What the scores entered for this hole do. */
export function HoleResultBox({ title, sub }: GameBox) {
	return <Box title={title} sub={sub} look="result" />;
}

function Box({ title, sub, look }: GameBox & { look: "standing" | "result" }) {
	const styles = useThemedStyles(createStyles);
	useAnnounceChange(sub ? `${title}, ${sub}` : title);
	return (
		<View
			accessible
			role="status"
			accessibilityLiveRegion="polite"
			style={[styles.box, styles[look]]}
		>
			<AppText variant="control" style={styles.title}>
				{title}
			</AppText>
			{sub ? <AppText variant="footnote">{sub}</AppText> : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		box: {
			gap: 2,
			paddingVertical: 10,
			paddingHorizontal: 14,
			borderRadius: radius.md,
			borderCurve: "continuous",
		},
		standing: { backgroundColor: colors.accentDim },
		result: {
			borderWidth: 1,
			borderColor: colors.borderStrong,
			marginTop: spacing.xs,
		},
		title: { fontWeight: "700" },
	});
