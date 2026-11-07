import type { ComponentRef, Ref } from "react";
import { StyleSheet, View } from "react-native";
import { darkColors as colors, radius, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";

type ShareCardProps = {
	course: string;
	/** "Sunday 1 November · Yellow". */
	detail: string;
	score: string;
	toPar: string;
	/** Up to three headline numbers beside the score (net, points, putts…). */
	stats: { label: string; value: string }[];
	/** Birdies, pars… with a count; zero counts are left out by the caller. */
	marks: { label: string; count: number }[];
	/** "Out 44 · In 41", when there are two nines. */
	nines: string | null;
	ref?: Ref<ComponentRef<typeof View>>;
};

const CARD_WIDTH = 360;
const BRAND = "Fairway";

export function ShareCard({ ref, ...props }: ShareCardProps) {
	return (
		<View ref={ref} collapsable={false} style={styles.card}>
			<View style={styles.top}>
				<AppText variant="label" style={styles.brand}>
					⛳ {BRAND.toUpperCase()}
				</AppText>
				<AppText variant="title" style={styles.text} numberOfLines={2}>
					{props.course}
				</AppText>
				<AppText variant="caption" style={styles.muted}>
					{props.detail}
				</AppText>
			</View>
			<View style={styles.scoreRow}>
				<AppText variant="quantity" style={styles.score}>
					{props.score}
				</AppText>
				<View style={styles.toPar}>
					<AppText variant="heading" style={styles.onAccent}>
						{props.toPar}
					</AppText>
				</View>
			</View>
			{props.stats.length > 0 ? (
				<View style={styles.stats}>
					{props.stats.map((stat) => (
						<View key={stat.label} style={styles.stat}>
							<AppText variant="metric" style={styles.text}>
								{stat.value}
							</AppText>
							<AppText variant="caption" style={styles.muted}>
								{stat.label}
							</AppText>
						</View>
					))}
				</View>
			) : null}
			{props.marks.length > 0 ? (
				<AppText variant="body" style={styles.text}>
					{props.marks.map((m) => `${m.count} ${m.label}`).join("  ·  ")}
				</AppText>
			) : null}
			{props.nines ? (
				<AppText variant="caption" style={styles.muted}>
					{props.nines}
				</AppText>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		width: CARD_WIDTH,
		padding: spacing.lg,
		gap: spacing.lg,
		// Square: rounded corners would be transparent, and some apps fill
		// transparency with white.
		backgroundColor: colors.bg,
	},
	top: { gap: spacing.xs },
	brand: { color: colors.accent, letterSpacing: 1.5 },
	text: { color: colors.text, fontVariant: ["tabular-nums"] },
	muted: { color: colors.textMuted },
	scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
	score: { color: colors.text, fontVariant: ["tabular-nums"] },
	toPar: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
		borderRadius: radius.lg,
		backgroundColor: colors.accentFill,
	},
	onAccent: { color: colors.onAccent, fontVariant: ["tabular-nums"] },
	stats: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	stat: {
		flex: 1,
		padding: spacing.md,
		gap: 2,
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
	},
});
