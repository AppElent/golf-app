/**
 * The React Native row with swipe, long-press and screen-reader actions, for
 * platforms without the SwiftUI list (`inset-list.ios.tsx`).
 *
 * A swipe is invisible to VoiceOver and TalkBack, so the actions are also named
 * custom actions, and the caller must still offer a visible route elsewhere.
 *
 * The pan runs on JS because it updates a core Animated.Value, which a worklet
 * must not capture.
 */
import { SymbolView } from "expo-symbols";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
	type AccessibilityActionEvent,
	Animated,
	Modal,
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
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { type RowAction, swipeActions } from "./inset-list.shared";
import { AppText } from "./text";

/** Spread onto the row's own focusable element so the actions reach a screen reader. */
export interface RowAccessibilityProps {
	accessibilityActions: readonly { name: string; label: string }[];
	onAccessibilityAction: (event: AccessibilityActionEvent) => void;
	onLongPress: () => void;
}

/** One action's slot: its capsule plus the space around it. */
const ACTION_WIDTH = 76;

/** Past this fraction of the travel the row stays open on release. */
const OPEN_THRESHOLD = 0.4;

export function SwipeableRow({
	actions,
	menuTitle,
	closeMenuLabel,
	children,
}: {
	actions: readonly RowAction[];
	/** Names the thing being acted on, so the menu is not four verbs with no subject. */
	menuTitle: string;
	closeMenuLabel: string;
	children: (accessibility: RowAccessibilityProps) => ReactNode;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const reduceMotion = useReduceMotion();
	const [menuOpen, setMenuOpen] = useState(false);
	const swipe = swipeActions(actions);
	const openWidth = ACTION_WIDTH * swipe.length;
	const translateX = useRef(new Animated.Value(0)).current;
	const offset = useRef(0);
	const passedThreshold = useRef(false);

	const settle = useCallback(
		(to: number) => {
			offset.current = to;
			if (reduceMotion) {
				translateX.setValue(to);
				return;
			}
			Animated.spring(translateX, {
				toValue: to,
				useNativeDriver: false,
				bounciness: 0,
				speed: 20,
			}).start();
		},
		[reduceMotion, translateX],
	);

	const runAction = useCallback(
		(action: RowAction) => {
			settle(0);
			setMenuOpen(false);
			action.onPress();
		},
		[settle],
	);

	const pan = useMemo(
		() =>
			Gesture.Pan()
				.runOnJS(true)
				// Only claim a clearly horizontal drag, so the list keeps scrolling.
				.activeOffsetX([-12, 12])
				.failOffsetY([-12, 12])
				.onBegin(() => {
					passedThreshold.current = false;
				})
				.onUpdate((event) => {
					// Rows with menu-only actions consume the drag but do not move.
					if (openWidth === 0) return;
					const next = offset.current + event.translationX;
					const clamped = Math.min(0, Math.max(-openWidth, next));
					translateX.setValue(clamped);
					const past = clamped <= -openWidth * OPEN_THRESHOLD;
					if (past !== passedThreshold.current) {
						passedThreshold.current = past;
						if (past) haptics.swipeThresholdPassed();
					}
				})
				.onEnd(() => {
					if (openWidth === 0) return;
					settle(passedThreshold.current ? -openWidth : 0);
				}),
		[openWidth, settle, translateX],
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
			onLongPress: () => {
				haptics.menuOpened();
				setMenuOpen(true);
			},
		}),
		[actions, runAction],
	);

	return (
		<View style={styles.clip}>
			<View style={[styles.actionsLayer, { width: openWidth }]}>
				{swipe.map((action) => (
					<Pressable
						key={action.key}
						onPress={() => runAction(action)}
						accessibilityRole="button"
						accessibilityLabel={action.label}
						style={styles.action}
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
										name={action.systemImage}
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
			</View>

			<GestureDetector gesture={pan}>
				{/* The row's own opaque background is what hides the actions. */}
				<Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
					{children(accessibility)}
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
			animationType={modalAnimation(reduceMotion)}
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
		capsule: {
			alignSelf: "stretch",
			height: 40,
			borderRadius: radius.pill,
			borderCurve: "continuous",
			alignItems: "center",
			justifyContent: "center",
		},
		actionLabel: { color: colors.textMuted },
		actionPressed: { opacity: 0.7 },
		row: { backgroundColor: colors.surface },
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
			minHeight: metrics.rowMinHeight,
			justifyContent: "center",
			paddingHorizontal: spacing.sm,
		},
	});
