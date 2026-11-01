import { Stack } from "expo-router";
import { Button, Platform } from "react-native";
import { useTokens } from "../theme";

/** Titles and actions belong to the navigator, outside the scrolling content. */
export function ScreenHeader({
	title,
	action,
}: {
	title: string;
	action?: { label: string; onPress: () => void; disabled?: boolean };
}) {
	const colors = useTokens();
	return (
		<>
			<Stack.Screen
				options={{
					title,
					...(Platform.OS !== "ios" && action
						? {
								headerRight: () => (
									<Button
										title={action.label}
										onPress={action.onPress}
										disabled={action.disabled}
										color={colors.accent}
									/>
								),
							}
						: {}),
				}}
			/>
			{Platform.OS === "ios" && action ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button
						onPress={action.onPress}
						disabled={action.disabled}
					>
						{action.label}
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
		</>
	);
}
