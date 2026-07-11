/** Shared gradients, patterns, and filters for the hole map. IDs are global. */
export function HoleMapDefs() {
	return (
		<defs>
			<radialGradient id="hm-rough" cx="50%" cy="40%" r="75%">
				<stop offset="0%" stopColor="var(--color-map-semi)" />
				<stop offset="100%" stopColor="var(--color-map-rough)" />
			</radialGradient>
			<radialGradient id="hm-green" cx="50%" cy="45%" r="65%">
				<stop offset="0%" stopColor="#8fd6a2" />
				<stop offset="100%" stopColor="var(--color-map-green)" />
			</radialGradient>
			<linearGradient id="hm-water" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stopColor="#a9d3e0" />
				<stop offset="100%" stopColor="var(--color-water)" />
			</linearGradient>
			{/* Mow stripes: alternating fairway shades rotated ~10°. */}
			<pattern
				id="hm-mow"
				width="18"
				height="18"
				patternUnits="userSpaceOnUse"
				patternTransform="rotate(10)"
			>
				<rect width="18" height="18" fill="var(--color-map-fairway)" />
				<rect width="9" height="18" fill="#cee0a6" />
			</pattern>
			<filter id="hm-soft" x="-20%" y="-20%" width="140%" height="140%">
				<feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.18" />
			</filter>
		</defs>
	);
}
