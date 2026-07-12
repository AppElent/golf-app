export function Sparkline({
	values,
	width = 120,
	height = 36,
	stroke = "var(--color-mint)",
}: {
	values: ReadonlyArray<number>;
	width?: number;
	height?: number;
	stroke?: string;
}) {
	if (values.length < 2) return null;
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const pad = 3;
	const stepX = (width - pad * 2) / (values.length - 1);
	const points = values.map((v, i) => {
		const x = pad + i * stepX;
		// Lower index = better handicap → draw it higher on screen (invert y).
		const y = pad + (height - pad * 2) * ((v - min) / span);
		return { x, y };
	});
	const d = points
		.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
		.join(" ");
	const last = points[points.length - 1];
	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
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
