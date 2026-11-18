/** Colors of a card. Pair with `border`. */
export const SURFACE = "border-card-line bg-surface";

/** Colors of an unselected control (a button, toggle or option). Its edge
 *  reaches 3:1 in dark mode; in light it matches a card. Pair with `border`. */
export const CONTROL = "border-control-line bg-surface";

/** A text input, select or textarea. Placeholders use `stone` (4.5:1), not
 *  the browser's half-transparent text colour. */
export const FIELD =
	"rounded-lg border border-control-line bg-field text-ink placeholder:text-stone";

export const CTA =
	"w-full rounded-full bg-flag px-6 py-4 font-display font-bold text-white shadow-lg shadow-flag/25";
