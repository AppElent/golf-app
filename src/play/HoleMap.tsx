import type { Club } from "@fairway/core/club-suggest";
import type { LatLng } from "@fairway/core/geo";
import { buildProjector, type Point } from "@fairway/core/hole-projection";
import type {
	HoleAnchors,
	HoleGeometry,
	HoleNumbers,
} from "@fairway/core/hole-view";
import { useRef, useState } from "react";
import { HoleMapDefs, MAP_HEIGHT, MAP_WIDTH } from "./defs";
import { GroundLayer } from "./GroundLayer";
import { InfoOverlay } from "./InfoOverlay";

export type MapVariant = "map" | "rings" | "bignumbers";

const PADDING = 28;

/** Mount one per hole (`key`): the measured point belongs to a hole. */
export function HoleMap({
	geometry,
	anchors,
	numbers,
	position,
	aim,
	bag,
	variant,
	accuracyM,
	onStandAt,
	onAimChange,
}: {
	geometry: HoleGeometry;
	anchors: HoleAnchors;
	numbers: HoleNumbers;
	position: LatLng;
	aim: LatLng;
	bag: ReadonlyArray<Club>;
	variant: MapVariant;
	accuracyM: number | null;
	/** Simulation mode: a tap puts the player there instead of measuring. */
	onStandAt?: (position: LatLng) => void;
	onAimChange: (aim: LatLng) => void;
}) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [measure, setMeasure] = useState<LatLng | null>(null);
	const dragging = useRef(false);

	const proj = buildProjector({
		tee: anchors.tee,
		green: anchors.green,
		features: [
			geometry.holeLine ?? [],
			...geometry.fairways,
			...geometry.greens,
			...geometry.bunkers,
			...geometry.water,
			...geometry.tees,
			[position, aim],
		],
		width: MAP_WIDTH,
		height: MAP_HEIGHT,
		padding: PADDING,
	});

	const svgPointFromEvent = (e: React.PointerEvent): Point => {
		const rect = svgRef.current?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		return {
			x: ((e.clientX - rect.left) / rect.width) * MAP_WIDTH,
			y: ((e.clientY - rect.top) / rect.height) * MAP_HEIGHT,
		};
	};

	function onPointerDown(e: React.PointerEvent) {
		const pt = svgPointFromEvent(e);
		if (onStandAt) {
			onStandAt(proj.unproject(pt));
			return;
		}
		const aimPt = proj.project(aim);
		if (Math.hypot(pt.x - aimPt.x, pt.y - aimPt.y) < 22) {
			dragging.current = true;
			(e.target as Element).setPointerCapture?.(e.pointerId);
		} else {
			setMeasure(proj.unproject(pt));
		}
	}
	function onPointerMove(e: React.PointerEvent) {
		if (!dragging.current) return;
		onAimChange(proj.unproject(svgPointFromEvent(e)));
	}
	function onPointerUp() {
		dragging.current = false;
	}

	return (
		<svg
			ref={svgRef}
			viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
			className="w-full touch-none select-none rounded-[22px]"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			role="img"
			aria-label="Hole map"
		>
			<HoleMapDefs />
			<GroundLayer geometry={geometry} green={anchors.green} proj={proj} />

			{variant === "rings" ? (
				<RangeRings center={proj.project(position)} scale={proj.scale} />
			) : null}
			{variant === "bignumbers" ? <BigNumbers numbers={numbers} /> : null}
			{variant === "map" ? (
				<InfoOverlay
					proj={proj}
					geometry={geometry}
					green={anchors.green}
					numbers={numbers}
					position={position}
					aim={aim}
					bag={bag}
					accuracyM={accuracyM}
					measure={measure}
				/>
			) : null}
		</svg>
	);
}

function RangeRings({ center, scale }: { center: Point; scale: number }) {
	return (
		<g>
			{[100, 150, 200].map((m) => (
				<g key={m}>
					<circle
						cx={center.x}
						cy={center.y}
						r={m * scale}
						fill="none"
						stroke="#fff"
						strokeOpacity={0.6}
					/>
					<text x={center.x + m * scale} y={center.y} fontSize={11} fill="#fff">
						{m}
					</text>
				</g>
			))}
			<circle
				cx={center.x}
				cy={center.y}
				r={4}
				fill="var(--color-live)"
				stroke="#fff"
				strokeWidth={2}
			/>
		</g>
	);
}

function BigNumbers({ numbers }: { numbers: HoleNumbers }) {
	return (
		<g>
			<rect
				x={0}
				y={0}
				width={MAP_WIDTH}
				height={MAP_HEIGHT}
				fill="var(--color-pine)"
				opacity={0.72}
			/>
			<text
				x={MAP_WIDTH / 2}
				y={MAP_HEIGHT / 2}
				textAnchor="middle"
				fontSize={112}
				fontWeight={800}
				fill="#fff"
			>
				{Math.round(numbers.center)}
			</text>
			<text
				x={MAP_WIDTH / 2}
				y={MAP_HEIGHT / 2 + 44}
				textAnchor="middle"
				fontSize={16}
				fill="#fff"
				opacity={0.7}
			>
				CENTER · {Math.round(numbers.front)} F / {Math.round(numbers.back)} B
			</text>
		</g>
	);
}
