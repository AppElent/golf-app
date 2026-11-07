import Svg, { Circle, Path } from "react-native-svg";

const WIDTH = 120;
const HEIGHT = 44;
const PAD = 4;

/** Lower index is better, so it draws higher. */
export function Sparkline({
	values,
	color,
	label,
}: {
	values: readonly number[];
	color: string;
	label: string;
}) {
	const min = Math.min(...values);
	const span = Math.max(...values) - min || 1;
	const step = (WIDTH - PAD * 2) / (values.length - 1);
	const points = values.map((v, i) => ({
		x: PAD + i * step,
		y: PAD + (HEIGHT - PAD * 2) * ((v - min) / span),
	}));
	const d = points
		.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
		.join(" ");
	const last = points[points.length - 1];
	return (
		<Svg
			width={WIDTH}
			height={HEIGHT}
			accessibilityRole="image"
			accessibilityLabel={label}
		>
			<Path
				d={d}
				stroke={color}
				strokeWidth={2.5}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
			<Circle cx={last.x} cy={last.y} r={3.5} fill={color} />
		</Svg>
	);
}
