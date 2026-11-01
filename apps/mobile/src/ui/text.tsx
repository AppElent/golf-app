/**
 * The only component allowed to set a font size. Screens pass a `variant`
 * name from the type ramp; a screen that reaches for `fontSize` is drift.
 *
 * Colour comes from `useTokens()`, not from the ramp: the ramp's `color` is
 * the dark value for legacy static consumers, and this is where every piece
 * of text in the app becomes scheme-aware at once. A caller's `style` still
 * wins, so `color:` overrides keep working.
 */
import { Text, type TextProps } from "react-native";
import { type as typeRamp, useTokens } from "../theme";

type Variant = keyof typeof typeRamp;
type Props = TextProps & { variant?: Variant };

/** Variants whose ink is the secondary colour; everything else is primary. */
const MUTED: ReadonlySet<Variant> = new Set<Variant>([
	"label",
	"caption",
	"secondary",
	"footnote",
]);

export function AppText({ variant = "body", style, ...rest }: Props) {
	const tokens = useTokens();
	const color = MUTED.has(variant) ? tokens.textMuted : tokens.text;
	return <Text style={[typeRamp[variant], { color }, style]} {...rest} />;
}
