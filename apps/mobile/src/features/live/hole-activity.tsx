/**
 * The Live Activity a round shows on the Lock Screen and in the Dynamic
 * Island: the hole, its par and the front / centre / back of the green.
 *
 * The component runs in the widget extension's own runtime (the 'widget'
 * directive), so everything it uses is declared inside it and every value
 * arrives through props. `live-hole.ts` starts, feeds and ends it.
 */
import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
	font,
	foregroundStyle,
	monospacedDigit,
	padding,
} from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

export type HoleActivityProps = {
	/** "Hole 7" in the app's language. */
	hole: string;
	/** "7": the Dynamic Island's room. */
	holeShort: string;
	/** "Par 4 · De Oosterhoutse". */
	detail: string;
	front: string;
	center: string;
	back: string;
	/** "m" or "yd". */
	unit: string;
	/** Localized F / C / B captions. */
	frontLabel: string;
	centerLabel: string;
	backLabel: string;
};

const HoleActivity = (
	props: HoleActivityProps,
	environment: LiveActivityEnvironment,
) => {
	"widget";
	const accent = environment.isLuminanceReduced ? "#FFFFFF" : "#F5D90A";
	const muted = "#9AA59E";
	const side = (label: string, value: string) => (
		<VStack spacing={0}>
			<Text
				modifiers={[
					font({ size: 11, weight: "semibold" }),
					foregroundStyle(muted),
				]}
			>
				{label}
			</Text>
			<Text
				modifiers={[font({ size: 20, weight: "semibold" }), monospacedDigit()]}
			>
				{value}
			</Text>
		</VStack>
	);
	return {
		banner: (
			<HStack modifiers={[padding({ horizontal: 16, vertical: 12 })]}>
				<VStack alignment="leading" spacing={2}>
					<Text modifiers={[font({ size: 20, weight: "bold" })]}>
						{props.hole}
					</Text>
					<Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>
						{props.detail}
					</Text>
				</VStack>
				<Spacer />
				<HStack spacing={14}>
					{side(props.frontLabel, props.front)}
					<VStack spacing={0}>
						<Text
							modifiers={[
								font({ size: 11, weight: "semibold" }),
								foregroundStyle(accent),
							]}
						>
							{props.centerLabel}
						</Text>
						<Text
							modifiers={[
								font({ size: 34, weight: "heavy" }),
								monospacedDigit(),
								foregroundStyle(accent),
							]}
						>
							{props.center}
						</Text>
					</VStack>
					{side(props.backLabel, props.back)}
				</HStack>
			</HStack>
		),
		compactLeading: (
			<HStack spacing={3}>
				<Image systemName="flag.fill" color={accent} />
				<Text modifiers={[font({ weight: "semibold" })]}>
					{props.holeShort}
				</Text>
			</HStack>
		),
		compactTrailing: (
			<Text
				modifiers={[
					font({ weight: "bold" }),
					monospacedDigit(),
					foregroundStyle(accent),
				]}
			>
				{props.center}
			</Text>
		),
		minimal: (
			<Text modifiers={[font({ size: 12, weight: "bold" }), monospacedDigit()]}>
				{props.center}
			</Text>
		),
		expandedLeading: (
			<VStack alignment="leading" modifiers={[padding({ leading: 8 })]}>
				<Text modifiers={[font({ size: 17, weight: "bold" })]}>
					{props.hole}
				</Text>
				<Text modifiers={[font({ size: 12 }), foregroundStyle(muted)]}>
					{props.detail}
				</Text>
			</VStack>
		),
		expandedTrailing: (
			<VStack
				alignment="trailing"
				spacing={0}
				modifiers={[padding({ trailing: 8 })]}
			>
				<Text
					modifiers={[
						font({ size: 30, weight: "heavy" }),
						monospacedDigit(),
						foregroundStyle(accent),
					]}
				>
					{props.center}
				</Text>
				<Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>
					{props.unit}
				</Text>
			</VStack>
		),
		expandedBottom: (
			<HStack modifiers={[padding({ horizontal: 8 })]}>
				{side(props.frontLabel, props.front)}
				<Spacer />
				{side(props.backLabel, props.back)}
			</HStack>
		),
	};
};

export default createLiveActivity("HoleActivity", HoleActivity);
