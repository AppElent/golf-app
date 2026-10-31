import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { radius, spacing, useTokens } from "../theme";
import type { SelectionMenuProps } from "./selection-menu.types";
import { AppText } from "./text";
export function SelectionMenu({
	label,
	accessibilityLabel,
	groups,
	onSelect,
	disabled,
	trigger,
}: SelectionMenuProps) {
	const [open, setOpen] = useState(false);
	const colors = useTokens();
	return (
		<>
			<Pressable
				disabled={disabled}
				accessibilityState={{ disabled: Boolean(disabled) }}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel}
				onPress={() => setOpen(true)}
				style={{
					minHeight: 48,
					paddingHorizontal: spacing.md,
					justifyContent: "center",
				}}
			>
				<AppText>{trigger === "ellipsis" ? "⋯" : `${label} ↕`}</AppText>
			</Pressable>
			<Modal
				visible={open}
				transparent
				onRequestClose={() => setOpen(false)}
				animationType="fade"
			>
				<Pressable
					accessibilityLabel={accessibilityLabel}
					onPress={() => setOpen(false)}
					style={{
						flex: 1,
						justifyContent: "center",
						padding: spacing.lg,
						backgroundColor: colors.scrim,
					}}
				>
					<View
						accessibilityViewIsModal
						accessibilityRole="menu"
						style={{
							backgroundColor: colors.surface,
							borderRadius: radius.sheet,
							padding: spacing.md,
							maxHeight: "80%",
						}}
					>
						<ScrollView>
							{groups.map((group, index) => (
								<View key={group.title ?? index}>
									{group.title && (
										<AppText variant="caption">{group.title}</AppText>
									)}
									{group.options.map((option) => (
										<Pressable
											key={option.id}
											disabled={option.disabled}
											accessibilityRole="button"
											accessibilityState={{
												selected: option.selected,
												disabled: option.disabled,
											}}
											style={{ minHeight: 48, justifyContent: "center" }}
											onPress={() => {
												setOpen(false);
												onSelect(option.id);
											}}
										>
											<AppText
												style={
													option.destructive
														? { color: colors.danger }
														: undefined
												}
											>
												{option.label}
											</AppText>
										</Pressable>
									))}
								</View>
							))}
						</ScrollView>
					</View>
				</Pressable>
			</Modal>
		</>
	);
}
