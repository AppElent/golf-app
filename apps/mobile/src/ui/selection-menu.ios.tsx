import {
	Button,
	Host,
	HStack,
	Image,
	Menu,
	Section,
	Text,
	Toggle,
} from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	disabled,
	font,
	padding,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { useAppearance } from "../theme";
import type { SelectionMenuProps } from "./selection-menu.types";
export function SelectionMenu(props: SelectionMenuProps) {
	const { scheme, colors } = useAppearance();
	return (
		<Host
			colorScheme={scheme}
			seedColor={colors.text}
			matchContents
			style={{ minHeight: 48, justifyContent: "center" }}
		>
			<Menu
				label={
					<HStack
						spacing={6}
						modifiers={[padding({ horizontal: 12, vertical: 12 })]}
					>
						{props.trigger === "ellipsis" ? (
							<Image systemName="ellipsis" size={20} />
						) : (
							<>
								<Text>{props.label}</Text>
								<Image systemName="chevron.up.chevron.down" size={12} />
							</>
						)}
					</HStack>
				}
				modifiers={[
					accessibilityLabel(props.accessibilityLabel),
					disabled(Boolean(props.disabled)),
				]}
			>
				{props.groups.map((group, index) => (
					<Section key={group.title ?? index} title={group.title}>
						{group.options.map((option) =>
							option.selected !== undefined ? (
								<Toggle
									key={option.id}
									label={option.label}
									isOn={option.selected}
									modifiers={[disabled(Boolean(option.disabled))]}
									onIsOnChange={() => props.onSelect(option.id)}
								/>
							) : (
								<Button
									key={option.id}
									label={option.label}
									systemImage={option.symbol}
									role={option.destructive ? "destructive" : "default"}
									modifiers={[
										disabled(Boolean(option.disabled)),
										...(option.emphasized
											? [tint(colors.accent), font({ weight: "semibold" })]
											: []),
									]}
									onPress={() => props.onSelect(option.id)}
								/>
							),
						)}
					</Section>
				))}
			</Menu>
		</Host>
	);
}
