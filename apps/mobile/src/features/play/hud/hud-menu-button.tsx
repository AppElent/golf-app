import { type MenuAction, MenuView } from "@expo/ui/community/menu";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { course, metrics } from "../../../theme";
import { HudGlass } from "./hud-glass";

type Symbol = ComponentProps<typeof SymbolView>["name"];

/** A HUD button that opens a native menu. */
export function HudMenuButton({
	symbol,
	label,
	actions,
}: {
	symbol: Symbol;
	label: string;
	actions: readonly {
		id: string;
		title: string;
		/** SF Symbol, iOS only. */
		image: MenuAction["image"];
		onPress: () => void;
	}[];
}) {
	return (
		<HudGlass style={styles.button}>
			<MenuView
				style={styles.button}
				actions={actions.map(({ id, title, image }) => ({ id, title, image }))}
				onPressAction={({ nativeEvent }) =>
					actions.find((action) => action.id === nativeEvent.event)?.onPress()
				}
			>
				<View
					accessible
					accessibilityRole="button"
					accessibilityLabel={label}
					style={[styles.button, styles.trigger]}
				>
					<SymbolView name={symbol} size={20} tintColor={course.hudText} />
				</View>
			</MenuView>
		</HudGlass>
	);
}

const SIZE = metrics.hitTarget + 4;
const styles = StyleSheet.create({
	button: { width: SIZE, height: SIZE },
	trigger: { alignItems: "center", justifyContent: "center" },
});
