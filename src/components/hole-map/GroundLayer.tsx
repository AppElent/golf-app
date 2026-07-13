import type { LatLng } from "../../domain/geo";
import type { HoleShapes, Projector } from "./projection";

const TREE_TONES = ["#3f7a4e", "#4f9160", "#68a878"];

/** Stable key from a ring's/point's own coordinates (data has no ids). */
function pointKey(p: LatLng): string {
	return `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}
function ringKey(ring: ReadonlyArray<LatLng>): string {
	return ring.length > 0 ? pointKey(ring[0]) : "empty";
}

function toPath(ring: ReadonlyArray<LatLng>, proj: Projector): string {
	if (ring.length === 0) return "";
	return `${ring
		.map((p, i) => {
			const s = proj.project(p);
			return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
		})
		.join(" ")} Z`;
}

/** Procedural illustrated ground: rough → fairway (mow stripes) → trees →
 *  water → bunkers → green (fringe) → flag. All from Fairway map tokens. */
export function GroundLayer({
	shapes,
	green,
	proj,
	width,
	height,
}: {
	shapes: HoleShapes;
	green: LatLng; // green center for the flag
	proj: Projector;
	width: number;
	height: number;
}) {
	const flag = proj.project(green);
	return (
		<g>
			{/* Rough base fills the whole viewport */}
			<rect x={0} y={0} width={width} height={height} fill="url(#hm-rough)" />

			{/* Fairways: mow-stripe fill + soft light edge */}
			{shapes.fairways.map((ring) => (
				<path
					key={`fw-${ringKey(ring)}`}
					d={toPath(ring, proj)}
					fill="url(#hm-mow)"
					stroke="#d8e7b4"
					strokeWidth={2}
					strokeLinejoin="round"
				/>
			))}

			{/* Trees (optional; clustered canopies with shadows) */}
			{(shapes.trees ?? []).map((t, i) => {
				const c = proj.project(t);
				return (
					<g key={`tree-${pointKey(t)}`} filter="url(#hm-soft)">
						<circle
							cx={c.x}
							cy={c.y}
							r={7}
							fill={TREE_TONES[i % TREE_TONES.length]}
						/>
					</g>
				);
			})}

			{/* Water: gradient + edge + ripple arcs */}
			{shapes.water.map((ring) => {
				const d = toPath(ring, proj);
				return (
					<g key={`wa-${ringKey(ring)}`}>
						<path
							d={d}
							fill="url(#hm-water)"
							stroke="#6fa9bd"
							strokeWidth={1.5}
						/>
					</g>
				);
			})}

			{/* Bunkers: sand fill + darker edge */}
			{shapes.bunkers.map((ring) => (
				<path
					key={`bk-${ringKey(ring)}`}
					d={toPath(ring, proj)}
					fill="var(--color-sand)"
					stroke="#cdbd84"
					strokeWidth={1.5}
					strokeLinejoin="round"
				/>
			))}

			{/* Green: thick soft fringe ring under a radial-gradient putting surface */}
			{shapes.greens.map((ring) => {
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

			{/* Flag at green center with a shadow ellipse */}
			<ellipse
				cx={flag.x}
				cy={flag.y + 3}
				rx={5}
				ry={2}
				fill="#0f3d2a"
				opacity={0.25}
			/>
			<line
				x1={flag.x}
				y1={flag.y}
				x2={flag.x}
				y2={flag.y - 22}
				stroke="#16241c"
				strokeWidth={1.5}
			/>
			<path
				d={`M${flag.x} ${flag.y - 22} L${flag.x + 12} ${flag.y - 18} L${flag.x} ${flag.y - 14} Z`}
				fill="var(--color-flag)"
			/>
			<circle cx={flag.x} cy={flag.y} r={2.5} fill="#16241c" />
		</g>
	);
}
