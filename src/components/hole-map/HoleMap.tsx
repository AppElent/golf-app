import { useRef, useState } from "react";
import {
	distancesToGreen,
	haversineMeters,
	type LatLng,
} from "../../domain/geo";
import { HoleMapDefs } from "./defs";
import { GroundLayer } from "./GroundLayer";
import { type HazardChip, InfoOverlay } from "./InfoOverlay";
import { buildProjector, type HoleShapes, type Point } from "./projection";

export type MapVariant = "map" | "rings" | "bignumbers";

const WIDTH = 360;
const HEIGHT = 560;
const PADDING = 28;

function centroid(ring: ReadonlyArray<LatLng>): LatLng {
	const n = ring.length || 1;
	return {
		lat: ring.reduce((t, p) => t + p.lat, 0) / n,
		lng: ring.reduce((t, p) => t + p.lng, 0) / n,
	};
}

export function HoleMap({
	shapes,
	position,
	aim,
	onAimChange,
	clubFor,
	variant,
	accuracyM = null,
}: {
	shapes: HoleShapes;
	position: LatLng;
	aim: LatLng;
	onAimChange: (p: LatLng) => void;
	clubFor: (distanceM: number) => string | null;
	variant: MapVariant;
	accuracyM?: number | null;
}) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [measure, setMeasure] = useState<LatLng | null>(null);
	const dragging = useRef(false);

	const green = shapes.greens[0] ?? [position];
	const greenCenter = centroid(green);
	const tee =
		shapes.tees[0] !== undefined
			? centroid(shapes.tees[0])
			: (shapes.holeLine[0] ?? position);

	const proj = buildProjector({
		tee,
		green: greenCenter,
		features: [
			shapes.holeLine,
			...shapes.fairways,
			...shapes.greens,
			...shapes.bunkers,
			...shapes.water,
			...shapes.tees,
			[position, aim],
		],
		width: WIDTH,
		height: HEIGHT,
		padding: PADDING,
	});

	const svgPointFromEvent = (e: React.PointerEvent): Point => {
		const rect = svgRef.current?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		return {
			x: ((e.clientX - rect.left) / rect.width) * WIDTH,
			y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
		};
	};

	const { front, center, back } = distancesToGreen(position, green);
	const youToAim = haversineMeters(position, aim);
	const aimToGreen = haversineMeters(aim, greenCenter);

	const hazards: HazardChip[] = [
		...shapes.water.map((w) => ({ ring: w, label: "Water" })),
		...shapes.bunkers.map((b) => ({ ring: b, label: "Bunker" })),
	]
		.map(({ ring, label }) => {
			const dists = ring.map((p) => haversineMeters(position, p));
			return {
				label,
				reach: Math.min(...dists),
				carry: Math.max(...dists),
				point: proj.project(centroid(ring)),
			};
		})
		.filter((h) => h.carry > 30 && h.reach < back) // only meaningful, in-play hazards
		.sort((a, b) => a.reach - b.reach)
		.slice(0, 3);

	const posPt = proj.project(position);
	const aimPt = proj.project(aim);
	const greenPt = proj.project(greenCenter);

	function onPointerDown(e: React.PointerEvent) {
		const pt = svgPointFromEvent(e);
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
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			className="w-full touch-none select-none rounded-[22px]"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			role="img"
			aria-label="Hole map"
		>
			<HoleMapDefs />
			<GroundLayer
				shapes={shapes}
				green={greenCenter}
				proj={proj}
				width={WIDTH}
				height={HEIGHT}
			/>

			{variant === "rings" ? (
				<g>
					{[100, 150, 200].map((m) => (
						<g key={m}>
							<circle
								cx={posPt.x}
								cy={posPt.y}
								r={m * proj.scale}
								fill="none"
								stroke="#fff"
								strokeOpacity={0.6}
							/>
							<text
								x={posPt.x + m * proj.scale}
								y={posPt.y}
								fontSize={11}
								fill="#fff"
							>
								{m}
							</text>
						</g>
					))}
					<circle
						cx={posPt.x}
						cy={posPt.y}
						r={4}
						fill="var(--color-live)"
						stroke="#fff"
						strokeWidth={2}
					/>
				</g>
			) : null}

			{variant === "bignumbers" ? (
				<g>
					<rect
						x={0}
						y={0}
						width={WIDTH}
						height={HEIGHT}
						fill="#0f3d2a"
						opacity={0.72}
					/>
					<text
						x={WIDTH / 2}
						y={HEIGHT / 2}
						textAnchor="middle"
						fontSize={112}
						fontWeight={800}
						fill="#fff"
					>
						{Math.round(center)}
					</text>
					<text
						x={WIDTH / 2}
						y={HEIGHT / 2 + 44}
						textAnchor="middle"
						fontSize={16}
						fill="#fff"
						opacity={0.7}
					>
						CENTER · {Math.round(front)} F / {Math.round(back)} B
					</text>
				</g>
			) : null}

			{variant === "map" ? (
				<InfoOverlay
					proj={proj}
					width={WIDTH}
					height={HEIGHT}
					position={posPt}
					aim={aimPt}
					greenCenter={greenPt}
					front={front}
					center={center}
					back={back}
					youToAim={youToAim}
					aimToGreen={aimToGreen}
					clubLabel={clubFor(youToAim)}
					hazards={hazards}
					accuracyM={accuracyM}
					measure={measure ? proj.project(measure) : null}
					measureDist={measure ? haversineMeters(position, measure) : null}
				/>
			) : null}
		</svg>
	);
}
