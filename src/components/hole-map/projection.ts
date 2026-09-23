import { type LatLng, projectToLocal } from "../../domain/geo";

export interface Point {
	x: number;
	y: number;
}

export interface Projector {
	project(p: LatLng): Point;
	unproject(pt: Point): LatLng;
	scale: number;
}

/** A hole's renderable geometry in WGS84 (consumers project via a Projector). */
export interface HoleShapes {
	holeLine: LatLng[];
	fairways: LatLng[][];
	greens: LatLng[][];
	bunkers: LatLng[][];
	water: LatLng[][];
	tees: LatLng[][];
	trees?: LatLng[]; // optional points (not imported yet)
}

const EARTH_RADIUS_M = 6371000;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/**
 * Build a projector that maps a hole's WGS84 geometry to SVG pixels with the
 * tee→green axis vertical (green up), fit to a padded viewport. Layer-agnostic:
 * any ground layer (procedural now, satellite later) shares this transform.
 */
export function buildProjector(opts: {
	tee: LatLng;
	green: LatLng;
	features: ReadonlyArray<ReadonlyArray<LatLng>>;
	width: number;
	height: number;
	padding: number;
}): Projector {
	const { tee, green, features, width, height, padding } = opts;

	// 1) Local meters around the tee (x east, y north).
	const teeLocal = projectToLocal(tee, tee); // {0,0}
	const greenLocal = projectToLocal(tee, green);

	// 2) Rotation φ that turns the tee→green vector to point "north" (+y).
	const axisAngle = Math.atan2(
		greenLocal.y - teeLocal.y,
		greenLocal.x - teeLocal.x,
	);
	const phi = Math.PI / 2 - axisAngle;
	const cos = Math.cos(phi);
	const sin = Math.sin(phi);
	const rotate = (m: Point): Point => ({
		x: m.x * cos - m.y * sin,
		y: m.x * sin + m.y * cos,
	});

	// 3) Bounding box of every feature point in rotated meter space.
	const rotatedPoints = features
		.flat()
		.map((p) => rotate(projectToLocal(tee, p)));
	const xs = rotatedPoints.map((p) => p.x);
	const ys = rotatedPoints.map((p) => p.y);
	const minX = Math.min(...xs, 0);
	const maxX = Math.max(...xs, 0);
	const minY = Math.min(...ys, 0);
	const maxY = Math.max(...ys, 0);

	const availW = width - 2 * padding;
	const availH = height - 2 * padding;
	const spanX = maxX - minX || 1;
	const spanY = maxY - minY || 1;
	const scale = Math.min(availW / spanX, availH / spanY);

	// Center the scaled bbox in the viewport; flip y so north is up.
	const offsetX = padding + (availW - spanX * scale) / 2;
	const offsetY = padding + (availH - spanY * scale) / 2;

	const project = (p: LatLng): Point => {
		const r = rotate(projectToLocal(tee, p));
		return {
			x: offsetX + (r.x - minX) * scale,
			y: offsetY + (maxY - r.y) * scale, // flip
		};
	};

	const unproject = (pt: Point): LatLng => {
		// Invert: screen → rotated meters → local meters → lat/lng.
		const rx = (pt.x - offsetX) / scale + minX;
		const ry = maxY - (pt.y - offsetY) / scale;
		// Un-rotate by −φ.
		const mx = rx * cos + ry * sin;
		const my = -rx * sin + ry * cos;
		// Inverse equirectangular around the tee.
		const lat = tee.lat + toDeg(my / EARTH_RADIUS_M);
		const lng =
			tee.lng +
			toDeg(mx / (EARTH_RADIUS_M * Math.cos((tee.lat * Math.PI) / 180)));
		return { lat, lng };
	};

	return { project, unproject, scale };
}
