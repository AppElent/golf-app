import { type Club, suggestClub } from "@fairway/core/club-suggest";
import {
	carryDistances,
	GPS_WEAK_ACCURACY_M,
	haversineMeters,
	type LatLng,
} from "@fairway/core/geo";
import type { Point, Projector } from "@fairway/core/hole-projection";
import type { HoleGeometry, HoleNumbers } from "@fairway/core/hole-view";
import { MAP_HEIGHT, MAP_WIDTH } from "./defs";

export function InfoOverlay({
	proj,
	geometry,
	green,
	numbers,
	position,
	aim,
	bag,
	accuracyM,
	measure,
}: {
	proj: Projector;
	geometry: HoleGeometry;
	green: LatLng;
	numbers: HoleNumbers;
	position: LatLng;
	aim: LatLng;
	bag: ReadonlyArray<Club>;
	accuracyM: number | null;
	measure: LatLng | null;
}) {
	const you = proj.project(position);
	const youToAim = haversineMeters(position, aim);
	return (
		<g>
			<DistanceArcs center={you} scale={proj.scale} />
			<ShotLine
				from={you}
				aim={proj.project(aim)}
				green={proj.project(green)}
				youToAim={youToAim}
				aimToGreen={haversineMeters(aim, green)}
				club={suggestClub(bag, youToAim)?.name ?? null}
			/>
			<DistanceLadder
				numbers={numbers}
				hazards={hazardChips(position, geometry, numbers.back)}
			/>
			{measure ? (
				<MeasureMarker
					from={you}
					to={proj.project(measure)}
					distance={haversineMeters(position, measure)}
				/>
			) : null}
			{accuracyM !== null && accuracyM > GPS_WEAK_ACCURACY_M ? (
				<circle
					cx={you.x}
					cy={you.y}
					r={accuracyM * proj.scale}
					fill="var(--color-live)"
					opacity={0.12}
				/>
			) : null}
			<circle
				cx={you.x}
				cy={you.y}
				r={7}
				fill="var(--color-live)"
				opacity={0.25}
			/>
			<circle
				cx={you.x}
				cy={you.y}
				r={4}
				fill="var(--color-live)"
				stroke="#fff"
				strokeWidth={2}
			/>
		</g>
	);
}

interface HazardChip {
	label: string;
	reach: number;
	carry: number;
}

/** Not core's `hazardsInPlay`, which also drops hazards behind you or past the
 *  green and caps at 330 m; merging the two would change what this ladder lists. */
function hazardChips(
	position: LatLng,
	geometry: HoleGeometry,
	back: number,
): HazardChip[] {
	return [
		...geometry.water.map((ring) => ({ ring, label: "Water" })),
		...geometry.bunkers.map((ring) => ({ ring, label: "Bunker" })),
	]
		.map(({ ring, label }) => ({
			label,
			...carryDistances(position, ring),
		}))
		.filter((h) => h.carry > 30 && h.reach < back)
		.sort((a, b) => a.reach - b.reach)
		.slice(0, 3);
}

function DistanceArcs({ center, scale }: { center: Point; scale: number }) {
	const arcs = [50, 100, 150, 200, 250].filter(
		(m) => m * scale < Math.hypot(MAP_WIDTH, MAP_HEIGHT),
	);
	return arcs.map((m) => (
		<g key={`arc-${m}`}>
			<circle
				cx={center.x}
				cy={center.y}
				r={m * scale}
				fill="none"
				stroke="#ffffff"
				strokeOpacity={0.35}
				strokeDasharray="3 6"
			/>
			<text
				x={center.x}
				y={center.y - m * scale}
				dy={-3}
				textAnchor="middle"
				fontSize={9}
				fill="#ffffff"
				opacity={0.7}
			>
				{m}
			</text>
		</g>
	));
}

function ShotLine({
	from,
	aim,
	green,
	youToAim,
	aimToGreen,
	club,
}: {
	from: Point;
	aim: Point;
	green: Point;
	youToAim: number;
	aimToGreen: number;
	club: string | null;
}) {
	return (
		<>
			<line
				x1={from.x}
				y1={from.y}
				x2={aim.x}
				y2={aim.y}
				stroke="var(--color-flag)"
				strokeWidth={2}
			/>
			<line
				x1={aim.x}
				y1={aim.y}
				x2={green.x}
				y2={green.y}
				stroke="#ffffff"
				strokeOpacity={0.5}
				strokeWidth={1.5}
				strokeDasharray="4 4"
			/>
			<circle
				cx={aim.x}
				cy={aim.y}
				r={13}
				fill="var(--color-flag)"
				opacity={0.2}
			/>
			<circle
				cx={aim.x}
				cy={aim.y}
				r={6}
				fill="var(--color-flag)"
				stroke="#fff"
				strokeWidth={2}
			/>
			<DistanceBadge
				x={aim.x}
				y={aim.y + 22}
				text={`${Math.round(youToAim)} m`}
				dark
			/>
			<DistanceBadge
				x={aim.x}
				y={aim.y - 22}
				text={`${Math.round(aimToGreen)} m`}
			/>
			{club ? (
				<g transform={`translate(${aim.x + 16}, ${aim.y})`}>
					<rect
						x={0}
						y={-11}
						rx={11}
						width={92}
						height={22}
						fill="var(--color-flag)"
					/>
					<text
						x={46}
						y={4}
						textAnchor="middle"
						fontSize={11}
						fontWeight={700}
						fill="#fff"
					>
						{club}
					</text>
				</g>
			) : null}
		</>
	);
}

function DistanceLadder({
	numbers,
	hazards,
}: {
	numbers: HoleNumbers;
	hazards: HazardChip[];
}) {
	return (
		<g transform="translate(12, 14)">
			<LadderRow y={0} label="BACK" value={Math.round(numbers.back)} />
			<LadderRow
				y={26}
				label="CENTER"
				value={Math.round(numbers.center)}
				highlight
			/>
			<LadderRow y={52} label="FRONT" value={Math.round(numbers.front)} />
			{hazards.map((h, i) => (
				<g
					key={`hz-${h.label}-${h.reach}-${h.carry}`}
					transform={`translate(0, ${84 + i * 20})`}
				>
					<text fontSize={9} fill="#fff" opacity={0.8}>
						{h.label} {Math.round(h.reach)}–{Math.round(h.carry)} m
					</text>
				</g>
			))}
		</g>
	);
}

function MeasureMarker({
	from,
	to,
	distance,
}: {
	from: Point;
	to: Point;
	distance: number;
}) {
	return (
		<g>
			<line
				x1={from.x}
				y1={from.y}
				x2={to.x}
				y2={to.y}
				stroke="var(--color-ink)"
				strokeOpacity={0.6}
				strokeDasharray="2 4"
			/>
			<circle cx={to.x} cy={to.y} r={4} fill="var(--color-ink)" />
			<DistanceBadge
				x={to.x}
				y={to.y - 14}
				text={`${Math.round(distance)} m`}
				dark
			/>
		</g>
	);
}

function DistanceBadge({
	x,
	y,
	text,
	dark,
}: {
	x: number;
	y: number;
	text: string;
	dark?: boolean;
}) {
	const w = 8 + text.length * 6.5;
	return (
		<g transform={`translate(${x - w / 2}, ${y - 9})`}>
			<rect
				rx={9}
				width={w}
				height={18}
				fill={dark ? "var(--color-ink)" : "#ffffff"}
			/>
			<text
				x={w / 2}
				y={13}
				textAnchor="middle"
				fontSize={11}
				fontWeight={700}
				fill={dark ? "#ffffff" : "var(--color-ink)"}
			>
				{text}
			</text>
		</g>
	);
}

function LadderRow({
	y,
	label,
	value,
	highlight,
}: {
	y: number;
	label: string;
	value: number;
	highlight?: boolean;
}) {
	return (
		<g transform={`translate(0, ${y})`}>
			<text fontSize={9} fill="#ffffff" opacity={0.7} letterSpacing={0.5}>
				{label}
			</text>
			<text
				y={15}
				fontSize={20}
				fontWeight={800}
				fill={highlight ? "var(--color-live)" : "#ffffff"}
			>
				{value}
				<tspan fontSize={10} opacity={0.7}>
					{" "}
					m
				</tspan>
			</text>
		</g>
	);
}
