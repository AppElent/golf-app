import type { Point, Projector } from "./projection";

export interface HazardChip {
	label: string; // e.g. "Water"
	reach: number;
	carry: number;
	point: Point; // screen point to anchor the chip near
}

export function InfoOverlay({
	proj,
	width,
	height,
	position,
	aim,
	greenCenter,
	front,
	center,
	back,
	youToAim,
	aimToGreen,
	clubLabel,
	hazards,
	accuracyM,
	measure,
	measureDist,
}: {
	proj: Projector;
	width: number;
	height: number;
	position: Point;
	aim: Point;
	greenCenter: Point;
	front: number;
	center: number;
	back: number;
	youToAim: number;
	aimToGreen: number;
	clubLabel: string | null;
	hazards: HazardChip[];
	accuracyM: number | null;
	measure: Point | null;
	measureDist: number | null;
}) {
	const arcs = [50, 100, 150, 200, 250].filter(
		(m) => m * proj.scale < Math.hypot(width, height),
	);
	return (
		<g>
			{/* Distance arcs every 50 m from the player */}
			{arcs.map((m) => (
				<g key={`arc-${m}`}>
					<circle
						cx={position.x}
						cy={position.y}
						r={m * proj.scale}
						fill="none"
						stroke="#ffffff"
						strokeOpacity={0.35}
						strokeDasharray="3 6"
					/>
					<text
						x={position.x}
						y={position.y - m * proj.scale}
						dy={-3}
						textAnchor="middle"
						fontSize={9}
						fill="#ffffff"
						opacity={0.7}
					>
						{m}
					</text>
				</g>
			))}

			{/* Shot line: you → aim → green center */}
			<line
				x1={position.x}
				y1={position.y}
				x2={aim.x}
				y2={aim.y}
				stroke="var(--color-flag)"
				strokeWidth={2}
			/>
			<line
				x1={aim.x}
				y1={aim.y}
				x2={greenCenter.x}
				y2={greenCenter.y}
				stroke="#ffffff"
				strokeOpacity={0.5}
				strokeWidth={1.5}
				strokeDasharray="4 4"
			/>

			{/* Aim point: draggable orange dot with halo (drag handled by HoleMap) */}
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
			{/* Split-distance badges: dark below aim (you→aim), white above (aim→green) */}
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

			{/* Club chip near the aim point */}
			{clubLabel ? (
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
						{clubLabel}
					</text>
				</g>
			) : null}

			{/* Distance ladder overlay top-left: BACK / CENTER / FRONT + hazard carries */}
			<g transform="translate(12, 14)">
				<LadderRow y={0} label="BACK" value={Math.round(back)} />
				<LadderRow y={26} label="CENTER" value={Math.round(center)} highlight />
				<LadderRow y={52} label="FRONT" value={Math.round(front)} />
				{hazards.map((h, i) => (
					<g
						key={`hz-${h.label}-${h.point.x}-${h.point.y}`}
						transform={`translate(0, ${84 + i * 20})`}
					>
						<text fontSize={9} fill="#fff" opacity={0.8}>
							{h.label} {Math.round(h.reach)}–{Math.round(h.carry)} m
						</text>
					</g>
				))}
			</g>

			{/* Tap-to-measure marker */}
			{measure && measureDist !== null ? (
				<g>
					<line
						x1={position.x}
						y1={position.y}
						x2={measure.x}
						y2={measure.y}
						stroke="#16241c"
						strokeOpacity={0.6}
						strokeDasharray="2 4"
					/>
					<circle cx={measure.x} cy={measure.y} r={4} fill="#16241c" />
					<DistanceBadge
						x={measure.x}
						y={measure.y - 14}
						text={`${Math.round(measureDist)} m`}
						dark
					/>
				</g>
			) : null}

			{/* You-are-here dot with GPS pulse + accuracy halo when >15 m */}
			{accuracyM !== null && accuracyM > 15 ? (
				<circle
					cx={position.x}
					cy={position.y}
					r={accuracyM * proj.scale}
					fill="var(--color-live)"
					opacity={0.12}
				/>
			) : null}
			<circle
				cx={position.x}
				cy={position.y}
				r={7}
				fill="var(--color-live)"
				opacity={0.25}
			/>
			<circle
				cx={position.x}
				cy={position.y}
				r={4}
				fill="var(--color-live)"
				stroke="#fff"
				strokeWidth={2}
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
			<rect rx={9} width={w} height={18} fill={dark ? "#16241c" : "#ffffff"} />
			<text
				x={w / 2}
				y={13}
				textAnchor="middle"
				fontSize={11}
				fontWeight={700}
				fill={dark ? "#ffffff" : "#16241c"}
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
