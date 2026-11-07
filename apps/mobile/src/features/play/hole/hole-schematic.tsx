/**
 * The hole's own OSM geometry, where there is no imagery: an Android build
 * without a Google Maps key.
 */
import { haversineMeters, type LatLng } from "@fairway/core/geo";
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
import { holeOverlays } from "./hole-overlays";

type Ring = ReadonlyArray<LatLng>;

/** Stable key from a ring's own first point (OSM rings have no ids). */
const ringKey = (ring: Ring) =>
	ring.length > 0 ? `${ring[0].lat},${ring[0].lng},${ring.length}` : "empty";

export function HoleSchematic(props: HoleCanvasProps) {
	const {
		geometry,
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
		shots,
	} = props;
	const [size, setSize] = useState({ width: 0, height: 0 });
	const { trail, toTargetSpot, toGreenSpot } = holeOverlays({
		shots,
		player,
		located,
		hazards,
		target,
		green,
	});
	const innerHeight = size.height - insets.top - insets.bottom;
	const innerWidth = size.width - insets.left - insets.right;

	const projector = useMemo(() => {
		if (innerWidth <= 0 || innerHeight <= 0) return null;
		const nearGreen = (ring: Ring) =>
			ring.some((p) => haversineMeters(p, green) < 25);
		const features: Ring[] = greenView
			? [...geometry.greens, ...geometry.bunkers.filter(nearGreen)]
			: [...geometry.fairways, ...geometry.greens, ...geometry.tees, [player]];
		return buildProjector({
			tee: player,
			green,
			features: features.length > 0 ? features : [[green]],
			width: innerWidth,
			height: innerHeight,
			padding: greenView ? 48 : 28,
			includeTee: !greenView,
		});
	}, [innerWidth, innerHeight, geometry, green, player, greenView]);

	const moveTarget = (x: number, y: number) => {
		if (projector)
			onTargetChange(
				projector.unproject({ x: x - insets.left, y: y - insets.top }),
			);
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
	const f = project(player);
	const tg = project(target);
	const gr = project(green);

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
						<G x={insets.left} y={insets.top}>
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
							{trail.slice(1).map((p, i) => {
								const a = project(trail[i]);
								const b = project(p);
								return (
									<Line
										key={`trail-${trail[i].lat},${trail[i].lng}`}
										x1={a.x}
										y1={a.y}
										x2={b.x}
										y2={b.y}
										stroke={course.shotLine}
										strokeWidth={2}
										strokeDasharray="6 6"
									/>
								);
							})}
							{shots.map((shot, i) => {
								const s = project(shot);
								return (
									<G key={`shot-${shot.lat},${shot.lng}`} x={s.x} y={s.y}>
										<Circle
											r={9}
											fill={course.labelFill}
											stroke={course.shotLine}
											strokeWidth={1.5}
										/>
										<SvgText
											y={typeRamp.micro.fontSize * 0.36}
											textAnchor="middle"
											fontSize={typeRamp.micro.fontSize}
											fontWeight="800"
											fill={course.distanceText}
										>
											{i + 1}
										</SvgText>
									</G>
								);
							})}
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
									p={project(h.at)}
									text={hazardLabel(h)}
									small
									// Beside the hazard, away from the line of play.
									side={project(h.at).x >= f.x ? "right" : "left"}
								/>
							))}
							<Label p={project(toTargetSpot)} text={toTargetLabel} />
							{targetToGreenLabel ? (
								<Label p={project(toGreenSpot)} text={targetToGreenLabel} />
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
