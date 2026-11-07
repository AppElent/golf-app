import type { LatLng } from "@fairway/core/geo";
import type { Projector } from "@fairway/core/hole-projection";
import type { HoleGeometry } from "@fairway/core/hole-view";
import { MAP_HEIGHT, MAP_WIDTH } from "./defs";

/** Rings have no ids in the data, so the key comes from their coordinates. */
function ringKey(ring: ReadonlyArray<LatLng>): string {
	if (ring.length === 0) return "empty";
	const first = ring[0];
	return `${first.lat.toFixed(6)},${first.lng.toFixed(6)}`;
}

const TEE_FILL: Readonly<Record<string, string>> = {
	white: "#ffffff",
	yellow: "#ffd400",
	blue: "#2f8fff",
	red: "#ff3b30",
	orange: "#ff9500",
};

function toPath(ring: ReadonlyArray<LatLng>, proj: Projector): string {
	if (ring.length === 0) return "";
	return `${ring
		.map((p, i) => {
			const s = proj.project(p);
			return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
		})
		.join(" ")} Z`;
}

export function GroundLayer({
	geometry,
	green,
	proj,
}: {
	geometry: HoleGeometry;
	green: LatLng;
	proj: Projector;
}) {
	const flag = proj.project(green);
	return (
		<g>
			<rect
				x={0}
				y={0}
				width={MAP_WIDTH}
				height={MAP_HEIGHT}
				fill="url(#hm-rough)"
			/>

			{geometry.fairways.map((ring) => (
				<path
					key={`fw-${ringKey(ring)}`}
					d={toPath(ring, proj)}
					fill="url(#hm-mow)"
					stroke="#d8e7b4"
					strokeWidth={2}
					strokeLinejoin="round"
				/>
			))}

			{geometry.water.map((ring) => (
				<path
					key={`wa-${ringKey(ring)}`}
					d={toPath(ring, proj)}
					fill="url(#hm-water)"
					stroke="#6fa9bd"
					strokeWidth={1.5}
				/>
			))}

			{geometry.bunkers.map((ring) => (
				<path
					key={`bk-${ringKey(ring)}`}
					d={toPath(ring, proj)}
					fill="var(--color-sand)"
					stroke="#cdbd84"
					strokeWidth={1.5}
					strokeLinejoin="round"
				/>
			))}

			{(geometry.teeBoxes ?? []).map((box) => {
				const at = proj.project(box.position);
				return (
					<circle
						key={`tee-${box.position.lat},${box.position.lng}`}
						data-tee={box.colors.join(" ")}
						cx={at.x}
						cy={at.y}
						r={4.5}
						fill={TEE_FILL[box.colors[0]] ?? "#ffffff"}
						stroke="var(--color-ink)"
						strokeWidth={1}
					/>
				);
			})}

			{geometry.greens.map((ring) => {
				const d = toPath(ring, proj);
				return (
					<g key={`gr-${ringKey(ring)}`}>
						<path
							d={d}
							fill="none"
							stroke="var(--color-map-green-edge)"
							strokeWidth={9}
							strokeLinejoin="round"
							opacity={0.5}
						/>
						<path d={d} fill="url(#hm-green)" />
					</g>
				);
			})}

			<ellipse
				cx={flag.x}
				cy={flag.y + 3}
				rx={5}
				ry={2}
				fill="var(--color-pine)"
				opacity={0.25}
			/>
			<line
				x1={flag.x}
				y1={flag.y}
				x2={flag.x}
				y2={flag.y - 22}
				stroke="var(--color-ink)"
				strokeWidth={1.5}
			/>
			<path
				d={`M${flag.x} ${flag.y - 22} L${flag.x + 12} ${flag.y - 18} L${flag.x} ${flag.y - 14} Z`}
				fill="var(--color-flag)"
			/>
			<circle cx={flag.x} cy={flag.y} r={2.5} fill="var(--color-ink)" />
		</g>
	);
}
