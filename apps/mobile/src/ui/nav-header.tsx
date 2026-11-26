import { Stack } from "expo-router";
import type { SFSymbol } from "expo-symbols";
import { Button, Platform } from "react-native";
import { useTokens } from "../theme";

interface NavHeaderAction {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	/** iOS: an SF Symbol drawn instead of the label, which is then only spoken. */
	icon?: SFSymbol;
}

/**
 * A screen's title and buttons belong to the navigator, outside the scrolling
 * content: the system toolbar on iOS, header buttons elsewhere.
 */
export function NavHeader({
	title,
	left,
	right,
}: {
	title: string;
	left?: NavHeaderAction;
	right?: NavHeaderAction;
}) {
	const colors = useTokens();
	const ios = Platform.OS === "ios";
	const button = (action: NavHeaderAction) => () => (
		<Button
			title={action.label}
			onPress={action.onPress}
			disabled={action.disabled}
			color={colors.accent}
		/>
	);
	return (
		<>
			<Stack.Screen
				options={{
					title,
					...(!ios && left ? { headerLeft: button(left) } : {}),
					...(!ios && right ? { headerRight: button(right) } : {}),
				}}
			/>
			{ios && left ? (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button onPress={left.onPress} disabled={left.disabled}>
						{left.label}
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			{ios && right ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button
						onPress={right.onPress}
						disabled={right.disabled}
						icon={right.icon}
						accessibilityLabel={right.icon ? right.label : undefined}
					>
						{right.label}
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
		</>
	);
}
