const WIDTH = 120;
const HEIGHT = 36;
const PAD = 3;

export function Sparkline({
	values,
	stroke = "var(--color-mint)",
}: {
	values: ReadonlyArray<number>;
	stroke?: string;
}) {
	if (values.length < 2) return null;
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const stepX = (WIDTH - PAD * 2) / (values.length - 1);
	const points = values.map((v, i) => {
		const x = PAD + i * stepX;
		// A lower handicap index is better, so it draws higher up.
		const y = PAD + (HEIGHT - PAD * 2) * ((v - min) / span);
		return { x, y };
	});
	const d = points
		.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
		.join(" ");
	const last = points[points.length - 1];
	return (
		<svg
			width={WIDTH}
			height={HEIGHT}
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			fill="none"
			role="img"
			aria-label="Trend"
		>
			<path
				d={d}
				stroke={stroke}
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx={last.x} cy={last.y} r={2.5} fill={stroke} />
		</svg>
	);
}
