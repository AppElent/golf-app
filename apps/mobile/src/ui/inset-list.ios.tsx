/**
 * The inset grouped list as a real SwiftUI `List`: system corners, separators,
 * swipe actions, context menu and Dynamic Type.
 *
 * A `List` has no intrinsic height and this one sits inside an RN `ScrollView`,
 * so it is `scrollDisabled` and its height comes from the list's own scroll
 * geometry (`contentHeight`, iOS 18+), with a row-count estimate until the first
 * measurement. `.swipeActions` only exists inside a `List`, which is why the
 * whole group is one.
 *
 * The negative margin undoes the screen gutter so the List's own inset-grouped
 * margins meet the screen edge at the system distance.
 */
import {
	Button,
	ContextMenu,
	Divider,
	Host,
	HStack,
	Image,
	List,
	RNHostView,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack,
} from "@expo/ui/swift-ui";
import {
	accessibilityAddTraits,
	accessibilityElement,
	accessibilityLabel,
	contentShape,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listRowBackground,
	listSectionMargins,
	listStyle,
	monospacedDigit,
	onTapGesture,
	padding,
	scrollContentBackground,
	scrollDisabled,
	shapes,
	tint,
	useScrollGeometryChange,
} from "@expo/ui/swift-ui/modifiers";
import { Children, Fragment, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { metrics, useAppearance, useTokens } from "../theme";
import {
	type InsetListProps,
	type InsetRowProps,
	rowSpokenLabel,
	swipeActions,
} from "./inset-list.shared";

/** Until the list reports its geometry: rows at the native default, plus chrome. */
function estimateHeight(rows: number, header?: string, footer?: string) {
	return rows * 52 + (header ? 44 : 20) + (footer ? 36 : 20);
}

export function InsetList({ header, footer, children }: InsetListProps) {
	const tokens = useTokens();
	const { scheme } = useAppearance();
	const [measured, setMeasured] = useState<number | null>(null);
	const geometry = useScrollGeometryChange((g) => {
		if (g.contentHeight > 0) setMeasured(Math.ceil(g.contentHeight));
	});
	const height =
		measured ?? estimateHeight(Children.count(children), header, footer);

	return (
		<View style={{ marginHorizontal: -16 }}>
			<Host
				colorScheme={scheme}
				seedColor={tokens.accent}
				style={{ width: "100%", height }}
			>
				<List
					modifiers={[
						listStyle("insetGrouped"),
						scrollDisabled(true),
						scrollContentBackground("hidden"),
						...(geometry ? [geometry] : []),
					]}
				>
					<Section
						modifiers={[listSectionMargins({ edges: "vertical", length: 0 })]}
						title={header}
						footer={footer ? <Text>{footer}</Text> : undefined}
					>
						{children}
					</Section>
				</List>
			</Host>
		</View>
	);
}

export function InsetRow({
	leading,
	title,
	secondary,
	value,
	trailing,
	chevron = false,
	destructive = false,
	onPress,
	actions,
}: InsetRowProps) {
	const tokens = useTokens();
	const { width } = useWindowDimensions();
	const spoken = rowSpokenLabel({ title, secondary });
	const swipe = swipeActions(actions ?? []);

	const row = (
		<HStack
			spacing={12}
			modifiers={[
				contentShape(shapes.rectangle()),
				listRowBackground(tokens.surface),
				...(trailing ? [] : [accessibilityElement("ignore")]),
				...(trailing ? [] : [accessibilityLabel(spoken)]),
				...(onPress && !trailing
					? [onTapGesture(onPress), accessibilityAddTraits(["isButton"])]
					: []),
			]}
		>
			{leading ? (
				<Image
					systemName={leading.symbol}
					size={20}
					color={tokens.accentInk}
					modifiers={[frame({ width: 28 })]}
				/>
			) : null}
			<VStack
				alignment="leading"
				spacing={1}
				modifiers={
					trailing
						? [
								frame({ minHeight: metrics.rowMinHeight }),
								contentShape(shapes.rectangle()),
								accessibilityElement("ignore"),
								accessibilityLabel(spoken),
								...(onPress
									? [
											onTapGesture(onPress),
											accessibilityAddTraits(["isButton"]),
										]
									: []),
							]
						: []
				}
			>
				<Text
					modifiers={[
						font({ textStyle: "body", weight: "semibold" }),
						foregroundStyle(destructive ? tokens.danger : tokens.text),
						lineLimit(2),
					]}
				>
					{title}
				</Text>
				{secondary ? (
					<Text
						modifiers={[
							font({ textStyle: "footnote" }),
							foregroundStyle(tokens.textMuted),
							lineLimit(2),
						]}
					>
						{secondary}
					</Text>
				) : null}
			</VStack>
			<Spacer />
			{trailing ? (
				<RNHostView matchContents>{trailing}</RNHostView>
			) : value ? (
				<Text
					modifiers={[
						font({ textStyle: "subheadline" }),
						foregroundStyle(tokens.textMuted),
						monospacedDigit(),
					]}
				>
					{value}
				</Text>
			) : null}
			{chevron ? (
				<Image
					systemName="chevron.right"
					size={13}
					color={tokens.textFaint}
					modifiers={[font({ weight: "semibold" })]}
				/>
			) : null}
		</HStack>
	);

	if (!actions || actions.length === 0) return row;

	const withMenu = (
		<ContextMenu>
			<ContextMenu.Items>
				{actions.map((action) => (
					<Fragment key={action.key}>
						<Button
							key={action.key}
							label={action.label}
							modifiers={[
								tint(action.destructive ? tokens.danger : tokens.text),
							]}
							systemImage={action.systemImage}
							role={action.destructive ? "destructive" : "default"}
							onPress={action.onPress}
						/>
						{action.dividerAfter ? <Divider /> : null}
					</Fragment>
				))}
			</ContextMenu.Items>
			<ContextMenu.Trigger>{row}</ContextMenu.Trigger>
			<ContextMenu.Preview>
				<VStack
					spacing={0}
					modifiers={[frame({ width: width - 64 }), padding({ all: 16 })]}
				>
					{row}
				</VStack>
			</ContextMenu.Preview>
		</ContextMenu>
	);

	if (swipe.length === 0) return withMenu;

	return (
		<SwipeActions>
			{withMenu}
			{/* Off explicitly: Expo UI defaults to SwiftUI's full-swipe-runs-it. */}
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				{[...swipe].reverse().map((action) => (
					<Button
						key={action.key}
						label={action.label}
						role={action.destructive ? "destructive" : "default"}
						systemImage={action.systemImage}
						onPress={action.onPress}
						modifiers={[
							tint(action.destructive ? tokens.danger : tokens.swipeNeutral),
						]}
					/>
				))}
			</SwipeActions.Actions>
		</SwipeActions>
	);
}
