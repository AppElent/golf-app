import type { ImageProps } from "@expo/ui/swift-ui";
import { type Href, Link } from "expo-router";
import { SymbolView } from "expo-symbols";
/**
 * A row whose actions can be reached three ways, none of which is the only way.
 *
 * Spec #68 is unusually specific here, so this component is built around the
 * constraint rather than decorated with it:
 *
 * - **Swipe reveals; a full swipe only runs what is safe to run.** By default
 *   the row's travel is clamped to the width of the actions it uncovers, and
 *   releasing leaves the buttons showing until a tap. Only an outermost action
 *   marked `fullSwipe` lets the row travel further: its button stretches, a
 *   haptic says letting go will run it, and it runs as if tapped. Such an
 *   action must still confirm or offer undo, so a fling cannot lose data.
 * - **The buttons match the native list's**: round capsules with an icon and
 *   the label under them, neutral or red, as SwiftUI swipe actions draw them.
 * - **Long press opens the same actions as a menu.** An accelerator for people
 *   who know it is there, never the only route to anything.
 * - **Screen readers get the actions as named custom actions**, which is the
 *   conventionally discoverable route on both platforms — a swipe is invisible
 *   to VoiceOver and TalkBack, and a row whose delete existed only in a gesture
 *   would be a row those users cannot delete.
 *
 * And above all three: the caller must still offer a visible route elsewhere.
 * On the Nutrition day that is the entry editor, which every row opens on a
 * plain tap and which carries its own visible Delete.
 *
 * The pan runs on JS because it updates a core Animated.Value. Native-driver
 * springs settle the row; a worklet must not capture that Animated.Value.
 *
 * The drag itself follows the finger — direct manipulation, not decoration —
 * but the snap at the end of it is animation, so Reduce Motion cuts it to an
 * instant move.
 */
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
	type AccessibilityActionEvent,
	ActionSheetIOS,
	Animated,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "../feedback/haptics";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { AppText } from "./text";

export interface RowAction {
	/** Stable across renders; also the accessibility action name. */
	key: string;
	systemImage?: ImageProps["systemName"];
	menuLabel?: string;
	dividerAfter?: boolean;
	/** Shown on the revealed button and spoken as the custom action. */
	label: string;
	onPress: () => void;
	/** Draws in the danger colour and reads as destructive. Never skips confirmation. */
	destructive?: boolean;
	/** Keep secondary actions in the menu without making a swipe wider than the row. */
	swipe?: boolean;
	/**
	 * Let a full swipe run this action. Only honoured on the last swipe action,
	 * the outermost button; the action must confirm or offer undo itself.
	 */
	fullSwipe?: boolean;
}

/** Spread onto the row's own focusable element so the actions reach a screen reader. */
export interface RowAccessibilityProps {
	accessibilityActions: readonly { name: string; label: string }[];
	onAccessibilityAction: (event: AccessibilityActionEvent) => void;
	onLongPress?: () => void;
	onPress?: () => void;
}

/** One action's slot: its capsule plus the space around it. */
const ACTION_WIDTH = 76;

/** Past this fraction of the travel the row stays open on release. */
const OPEN_THRESHOLD = 0.4;

/** Past this fraction of the row's width, letting go runs the full-swipe action. */
const COMMIT_THRESHOLD = 0.6;

export function SwipeableRow({
	href,
	actions,
	menuTitle,
	closeMenuLabel,
	showMenuButton = false,
	children,
}: {
	href?: Href;
	actions: readonly RowAction[];
	/** Names the thing being acted on, so the menu is not four verbs with no subject. */
	menuTitle: string;
	closeMenuLabel: string;
	showMenuButton?: boolean;
	children: (accessibility: RowAccessibilityProps) => ReactNode;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const reduceMotion = useReduceMotion();
	const [menuOpen, setMenuOpen] = useState(false);
	const swipeActions = actions.filter((action) => action.swipe !== false);
	const openWidth = ACTION_WIDTH * swipeActions.length;
	const fullAction = swipeActions.at(-1)?.fullSwipe
		? swipeActions.at(-1)
		: undefined;
	const [rowWidth, setRowWidth] = useState(0);
	const fullWidth = fullAction ? Math.max(rowWidth, openWidth) : openWidth;
	const translateX = useRef(new Animated.Value(0)).current;
	// Plain refs: the gesture callbacks run on the JS thread, so these are
	// ordinary reads and writes rather than anything shared across threads.
	const offset = useRef(0);
	const passedThreshold = useRef(false);
	const armed = useRef(false);

	const settle = useCallback(
		(to: number) => {
			offset.current = to;
			if (reduceMotion) {
				translateX.setValue(to);
				return;
			}
			// JS-driven: the stretching full-swipe button animates its width.
			Animated.spring(translateX, {
				toValue: to,
				useNativeDriver: false,
				bounciness: 0,
				speed: 20,
			}).start();
		},
		[reduceMotion, translateX],
	);

	const close = useCallback(() => settle(0), [settle]);

	const runAction = useCallback(
		(action: RowAction) => {
			close();
			setMenuOpen(false);
			action.onPress();
		},
		[close],
	);

	const openMenu = useCallback(() => {
		haptics.menuOpened();
		if (Platform.OS === "ios") {
			ActionSheetIOS.showActionSheetWithOptions(
				{
					title: menuTitle,
					options: [...actions.map((action) => action.label), closeMenuLabel],
					cancelButtonIndex: actions.length,
					destructiveButtonIndex: actions.flatMap((action, index) =>
						action.destructive ? [index] : [],
					),
				},
				(index) => {
					const action = actions[index];
					if (action) runAction(action);
				},
			);
		} else {
			setMenuOpen(true);
		}
	}, [actions, menuTitle, closeMenuLabel, runAction]);

	const pan = useMemo(
		() =>
			Gesture.Pan()
				// JS thread, so the callbacks below may touch `Animated.Value` and
				// the refs around it. See the note at the top of this file.
				.runOnJS(true)
				// Only claim a drag that is clearly horizontal, so the diary keeps
				// scrolling normally under a vertical finger.
				.activeOffsetX([-12, 12])
				.failOffsetY([-12, 12])
				.onBegin(() => {
					passedThreshold.current = false;
					armed.current = false;
				})
				.onUpdate((event) => {
					// Consume horizontal drags without turning them into row taps.
					// Rows with menu-only actions must neither move nor play feedback.
					if (openWidth === 0) return;
					const next = offset.current + event.translationX;
					// Closed at 0; open at the buttons' width, or the whole row when
					// the outermost action takes a full swipe.
					const clamped = Math.min(0, Math.max(-fullWidth, next));
					translateX.setValue(clamped);
					const past = clamped <= -openWidth * OPEN_THRESHOLD;
					if (past !== passedThreshold.current) {
						passedThreshold.current = past;
						if (past) haptics.swipeThresholdPassed();
					}
					if (fullAction && rowWidth > 0) {
						const commit = clamped <= -rowWidth * COMMIT_THRESHOLD;
						if (commit !== armed.current) {
							armed.current = commit;
							if (commit) haptics.swipeCommitArmed();
						}
					}
				})
				.onEnd(() => {
					if (openWidth === 0) return;
					if (fullAction && armed.current) {
						armed.current = false;
						runAction(fullAction);
						return;
					}
					settle(passedThreshold.current ? -openWidth : 0);
				}),
		[fullAction, fullWidth, openWidth, rowWidth, runAction, settle, translateX],
	);

	const accessibility = useMemo<RowAccessibilityProps>(
		() => ({
			accessibilityActions: actions.map((action) => ({
				name: action.key,
				label: action.label,
			})),
			onAccessibilityAction: (event: AccessibilityActionEvent) => {
				const action = actions.find(
					(candidate) => candidate.key === event.nativeEvent.actionName,
				);
				if (action) runAction(action);
			},
			onLongPress: openMenu,
			...(Platform.OS === "ios" && href
				? { onPress: undefined, onLongPress: undefined }
				: {}),
		}),
		[actions, openMenu, runAction, href],
	);

	return (
		<View
			style={styles.clip}
			onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
		>
			{/* Drawn behind the row and uncovered by it, so it is out of reach
			    until the swipe has actually revealed it. It grows with the swipe;
			    a full-swipe action takes the extra width. */}
			<Animated.View
				style={[
					styles.actionsLayer,
					{
						width: translateX.interpolate({
							inputRange: [-Math.max(fullWidth, openWidth + 1), -openWidth, 0],
							outputRange: [
								Math.max(fullWidth, openWidth + 1),
								openWidth,
								openWidth,
							],
							extrapolate: "clamp",
						}),
					},
				]}
			>
				{swipeActions.map((action) => (
					<Pressable
						key={action.key}
						onPress={() => runAction(action)}
						accessibilityRole="button"
						accessibilityLabel={action.label}
						style={[
							styles.action,
							action === fullAction ? styles.actionFull : null,
						]}
					>
						{({ pressed }) => (
							<>
								<View
									style={[
										styles.capsule,
										{
											backgroundColor: action.destructive
												? colors.danger
												: colors.swipeNeutral,
										},
										pressed && styles.actionPressed,
									]}
								>
									<SymbolView
										name={
											action.systemImage ??
											(action.destructive ? "trash" : "pencil")
										}
										size={20}
										weight="semibold"
										tintColor="#ffffff"
									/>
								</View>
								<AppText
									variant="caption"
									numberOfLines={1}
									style={styles.actionLabel}
								>
									{action.label}
								</AppText>
							</>
						)}
					</Pressable>
				))}
			</Animated.View>

			<GestureDetector gesture={pan}>
				{/* The row's own opaque background is what hides the actions. */}
				<Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
					<View style={{ flex: 1, minWidth: 0 }}>
						{Platform.OS === "ios" && href ? (
							<Link href={href} asChild>
								<Link.Trigger>{children(accessibility)}</Link.Trigger>
								<Link.Menu title={menuTitle}>
									{actions.map((action) => (
										<Link.MenuAction
											key={action.key}
											title={action.label}
											destructive={action.destructive}
											onPress={() => runAction(action)}
										/>
									))}
								</Link.Menu>
							</Link>
						) : (
							children(accessibility)
						)}
					</View>
					{showMenuButton ? (
						<Pressable
							onPress={openMenu}
							accessibilityRole="button"
							accessibilityLabel={menuTitle}
							style={styles.menuButton}
						>
							<AppText style={{ color: colors.textMuted }}>···</AppText>
						</Pressable>
					) : null}
				</Animated.View>
			</GestureDetector>

			<ActionMenu
				visible={menuOpen}
				title={menuTitle}
				actions={actions}
				closeLabel={closeMenuLabel}
				reduceMotion={reduceMotion}
				onSelect={runAction}
				onClose={() => setMenuOpen(false)}
			/>
		</View>
	);
}

/**
 * The long-press menu.
 *
 * Non-iOS fallback. iOS uses Link.Menu or the system action sheet.
 */
function ActionMenu({
	visible,
	title,
	actions,
	closeLabel,
	reduceMotion,
	onSelect,
	onClose,
}: {
	visible: boolean;
	title: string;
	actions: readonly RowAction[];
	closeLabel: string;
	reduceMotion: boolean;
	onSelect: (action: RowAction) => void;
	onClose: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	return (
		<Modal
			visible={visible}
			transparent
			animationType={modalAnimation(reduceMotion, "fade")}
			// Android's back button closes the menu rather than leaving the screen.
			onRequestClose={onClose}
		>
			<Pressable
				style={[
					styles.backdrop,
					{
						paddingBottom: insets.bottom + spacing.md,
						paddingTop: insets.top + spacing.md,
					},
				]}
				onPress={onClose}
			>
				{/* Swallows taps so pressing the card itself does not dismiss it. */}
				<Pressable
					style={styles.menu}
					onPress={() => {}}
					accessibilityViewIsModal
				>
					<AppText variant="heading">{title}</AppText>
					<ScrollView>
						{actions.map((action) => (
							<Pressable
								key={action.key}
								onPress={() => onSelect(action)}
								accessibilityRole="button"
								accessibilityLabel={action.label}
								style={({ pressed }) => [
									styles.menuItem,
									pressed && styles.actionPressed,
								]}
							>
								<AppText
									style={{
										fontWeight: "700",
										color: action.destructive ? colors.danger : colors.text,
									}}
								>
									{action.label}
								</AppText>
							</Pressable>
						))}
					</ScrollView>
					<Pressable
						onPress={onClose}
						accessibilityRole="button"
						accessibilityLabel={closeLabel}
						style={({ pressed }) => [
							styles.menuItem,
							pressed && styles.actionPressed,
						]}
					>
						<AppText style={{ color: colors.textMuted }}>{closeLabel}</AppText>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		clip: { overflow: "hidden" },
		actionsLayer: {
			position: "absolute",
			right: 0,
			top: 0,
			bottom: 0,
			flexDirection: "row",
			justifyContent: "flex-end",
			backgroundColor: colors.surface,
		},
		action: {
			width: ACTION_WIDTH,
			alignItems: "center",
			justifyContent: "center",
			gap: 4,
			paddingHorizontal: 6,
		},
		/** The full-swipe action takes whatever width the swipe adds. */
		actionFull: { flexGrow: 1 },
		capsule: {
			// The capsule plus its label make the 44pt+ hit area, as in SwiftUI.
			alignSelf: "stretch",
			height: 40,
			borderRadius: radius.pill,
			borderCurve: "continuous",
			alignItems: "center",
			justifyContent: "center",
		},
		actionLabel: { color: colors.textMuted },
		actionPressed: { opacity: 0.7 },
		row: {
			backgroundColor: colors.surface,
			flexDirection: "row",
			alignItems: "center",
		},
		menuButton: {
			minWidth: 44,
			minHeight: 44,
			alignItems: "center",
			justifyContent: "center",
		},

		backdrop: {
			flex: 1,
			backgroundColor: colors.scrim,
			justifyContent: "flex-end",
			padding: spacing.md,
		},
		menu: {
			maxHeight: "90%",
			backgroundColor: colors.surface,
			borderRadius: radius.sheet,
			borderWidth: 1,
			borderColor: colors.border,
			padding: spacing.md,
			gap: spacing.xs,
		},
		menuItem: {
			minHeight: 48,
			justifyContent: "center",
			paddingHorizontal: spacing.sm,
		},
	});
