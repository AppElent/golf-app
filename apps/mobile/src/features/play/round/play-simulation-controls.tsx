import { Pressable, StyleSheet, View } from "react-native";
import { useI18n } from "../../../i18n";
import { course, metrics, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { HudGlass } from "../hud/hud-glass";
import { hudStyles } from "../hud/hud-styles";

/** Set where the player stands: jump, walk, tap the map, or play the shot. */
export function PlaySimulationControls({
	bottom,
	hasNextTee,
	walking,
	moving,
	busy,
	onTee,
	onApproach,
	onGreen,
	onNextTee,
	onToggleMove,
	onToggleWalk,
	onHit,
}: {
	bottom: number;
	hasNextTee: boolean;
	walking: boolean;
	moving: boolean;
	busy: boolean;
	onTee: () => void;
	onApproach: () => void;
	onGreen: () => void;
	onNextTee: () => void;
	onToggleMove: () => void;
	onToggleWalk: () => void;
	onHit: () => void;
}) {
	const { t } = useI18n();
	return (
		<View style={[styles.panel, { bottom }]} pointerEvents="box-none">
			<HudGlass capsule={false} style={styles.glass}>
				<View style={styles.row}>
					<Control id="tee" label={t.play.simTee} onPress={onTee} />
					<Control
						id="approach"
						label={t.play.simApproach}
						onPress={onApproach}
					/>
					<Control id="green" label={t.play.simGreen} onPress={onGreen} />
					<Control
						id="next-tee"
						label={t.play.simNextTee}
						onPress={onNextTee}
						disabled={!hasNextTee}
					/>
				</View>
				<View style={styles.row}>
					<Control
						id="move"
						label={t.play.simMove}
						onPress={onToggleMove}
						active={moving}
					/>
					<Control
						id="walk"
						label={walking ? t.play.simStop : t.play.simWalk}
						onPress={onToggleWalk}
						active={walking}
					/>
					<Control
						id="hit"
						label={t.play.simHit}
						onPress={onHit}
						disabled={busy}
					/>
				</View>
			</HudGlass>
		</View>
	);
}

function Control({
	id,
	label,
	onPress,
	active,
	disabled,
}: {
	id: string;
	label: string;
	onPress: () => void;
	active?: boolean;
	disabled?: boolean;
}) {
	return (
		<Pressable
			testID={`sim-${id}`}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled, selected: active }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.control,
				active && styles.controlActive,
				(pressed || disabled) && { opacity: disabled ? 0.35 : 0.7 },
			]}
		>
			<AppText
				variant="caption"
				numberOfLines={1}
				style={active ? styles.controlTextActive : hudStyles.onHud}
			>
				{label}
			</AppText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	panel: { position: "absolute", left: spacing.md, right: spacing.md },
	glass: { padding: spacing.xs, gap: spacing.xs },
	row: { flexDirection: "row", gap: spacing.xs },
	control: {
		flex: 1,
		minHeight: metrics.hitTarget,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 12,
	},
	controlActive: { backgroundColor: course.target },
	controlTextActive: { color: course.onTarget, fontWeight: "800" },
});
