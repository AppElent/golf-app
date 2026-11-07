/** How screens set a font size: they pass a `variant` from the type ramp. */
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
