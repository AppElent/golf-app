/**
 * Vector hole view: the hole's own OSM geometry drawn tee → green, with the
 * same overlays as the satellite view. Used where there is no imagery — an
 * Android build without a Google Maps key — and as a fallback that never
 * needs the network. Tap or drag anywhere to move the target.
 */
import { haversineMeters, interpolate, type LatLng } from "@fairway/core/geo";
import { buildProjector } from "@fairway/core/hole-projection";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, {
	Circle,
	G,
	Line,
	Path,
	Rect,
	Text as SvgText,
} from "react-native-svg";
import { course, type as typeRamp } from "../../../theme";
import type { HoleCanvasProps } from "./hole-canvas-props";

type Ring = ReadonlyArray<LatLng>;

/** Stable key from a ring's own first point (OSM rings have no ids). */
const ringKey = (ring: Ring) =>
	ring.length > 0 ? `${ring[0].lat},${ring[0].lng},${ring.length}` : "empty";

export function HoleSchematic(props: HoleCanvasProps) {
	const {
		geometry,
		tee,
		green,
		player,
		located,
		target,
		onTargetChange,
		toTargetLabel,
		targetToGreenLabel,
		hazards,
		hazardLabel,
		greenView,
		insets,
	} = props;
	const [size, setSize] = useState({ width: 0, height: 0 });
	const from = located ? player : tee;
	const innerHeight = size.height - insets.top - insets.bottom;

	const projector = useMemo(() => {
		if (size.width === 0 || innerHeight <= 0) return null;
		const nearGreen = (ring: Ring) =>
			ring.some((p) => haversineMeters(p, green) < 25);
		const features: Ring[] = greenView
			? [...geometry.greens, ...geometry.bunkers.filter(nearGreen)]
			: [...geometry.fairways, ...geometry.greens, ...geometry.tees, [from]];
		return buildProjector({
			tee: from,
			green,
			features: features.length > 0 ? features : [[green]],
			width: size.width,
			height: innerHeight,
			padding: greenView ? 48 : 28,
			includeTee: !greenView,
		});
	}, [size.width, innerHeight, geometry, green, from, greenView]);

	const moveTarget = (x: number, y: number) => {
		if (projector)
			onTargetChange(projector.unproject({ x, y: y - insets.top }));
	};
	const gesture = Gesture.Exclusive(
		Gesture.Pan()
			.runOnJS(true)
			.minDistance(4)
			.onUpdate((e) => moveTarget(e.x, e.y)),
		Gesture.Tap()
			.runOnJS(true)
			.onEnd((e) => moveTarget(e.x, e.y)),
	);

	const project = (p: LatLng) =>
		projector ? projector.project(p) : { x: 0, y: 0 };
	const path = (ring: Ring) =>
		ring.length === 0
			? ""
			: `${ring
					.map((p, i) => {
						const s = project(p);
						return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
					})
					.join(" ")} Z`;
	const at = (p: LatLng) => project(p);
	const f = at(from);
	const tg = at(target);
	const gr = at(green);

	return (
		<GestureDetector gesture={gesture}>
			<View
				style={[StyleSheet.absoluteFill, styles.ground]}
				onLayout={(e) =>
					setSize({
						width: e.nativeEvent.layout.width,
						height: e.nativeEvent.layout.height,
					})
				}
			>
				{projector ? (
					<Svg width={size.width} height={size.height}>
						<Rect width={size.width} height={size.height} fill={course.rough} />
						<G y={insets.top}>
							{geometry.fairways.map((r) => (
								<Path
									key={`f${ringKey(r)}`}
									d={path(r)}
									fill={course.fairway}
								/>
							))}
							{geometry.tees.map((r) => (
								<Path key={`t${ringKey(r)}`} d={path(r)} fill={course.tee} />
							))}
							{geometry.water.map((r) => (
								<Path key={`w${ringKey(r)}`} d={path(r)} fill={course.water} />
							))}
							{geometry.bunkers.map((r) => (
								<Path key={`b${ringKey(r)}`} d={path(r)} fill={course.bunker} />
							))}
							{geometry.greens.map((r) => (
								<Path
									key={`g${ringKey(r)}`}
									d={path(r)}
									fill={course.greenFill}
								/>
							))}
							<Line
								x1={f.x}
								y1={f.y}
								x2={tg.x}
								y2={tg.y}
								stroke={course.targetLine}
								strokeWidth={3}
								strokeLinecap="round"
							/>
							<Line
								x1={tg.x}
								y1={tg.y}
								x2={gr.x}
								y2={gr.y}
								stroke={course.targetLine}
								strokeWidth={3}
								strokeLinecap="round"
							/>
							<Circle
								cx={gr.x}
								cy={gr.y}
								r={6}
								fill={course.flag}
								stroke={course.distanceText}
								strokeWidth={2}
							/>
							{located ? (
								<>
									<Circle cx={f.x} cy={f.y} r={14} fill={course.playerHalo} />
									<Circle
										cx={f.x}
										cy={f.y}
										r={7}
										fill={course.player}
										stroke={course.distanceText}
										strokeWidth={2}
									/>
								</>
							) : null}
							<Circle
								cx={tg.x}
								cy={tg.y}
								r={16}
								fill="none"
								stroke={course.target}
								strokeWidth={3}
							/>
							<Circle cx={tg.x} cy={tg.y} r={3} fill={course.target} />
							{/* Hazards first: the distance labels win any overlap. */}
							{hazards.map((h) => (
								<Label
									key={`${h.at.lat},${h.at.lng}`}
									p={at(h.at)}
									text={hazardLabel(h)}
									small
									// Beside the hazard, away from the line of play.
									side={at(h.at).x >= f.x ? "right" : "left"}
								/>
							))}
							<Label
								p={at(interpolate(from, target, 0.5))}
								text={toTargetLabel}
							/>
							{targetToGreenLabel ? (
								<Label
									p={at(interpolate(target, green, 0.5))}
									text={targetToGreenLabel}
								/>
							) : null}
						</G>
					</Svg>
				) : null}
			</View>
		</GestureDetector>
	);
}

function Label({
	p,
	text,
	small,
	side,
}: {
	p: { x: number; y: number };
	text: string;
	small?: boolean;
	/** Push the label off its point to this side; centred when unset. */
	side?: "left" | "right";
}) {
	const font = small ? typeRamp.caption : typeRamp.control;
	const width = text.length * font.fontSize * 0.62 + 14;
	const height = font.fontSize + 10;
	const shift = side ? (width / 2 + 18) * (side === "right" ? 1 : -1) : 0;
	return (
		<G x={p.x + shift} y={p.y}>
			<Rect
				x={-width / 2}
				y={-height / 2}
				width={width}
				height={height}
				rx={height / 2}
				fill={course.labelFill}
			/>
			<SvgText
				y={font.fontSize * 0.36}
				textAnchor="middle"
				fontSize={font.fontSize}
				fontWeight="800"
				fill={course.distanceText}
			>
				{text}
			</SvgText>
		</G>
	);
}

const styles = StyleSheet.create({
	ground: { backgroundColor: course.rough },
});
