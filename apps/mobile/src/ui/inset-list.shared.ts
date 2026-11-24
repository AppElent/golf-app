/**
 * What the two drawings of the inset grouped list share. `inset-list.ios.tsx`
 * is a SwiftUI `List`; `inset-list.tsx` draws the same shape in React Native for
 * Android and tests. Screens import `./inset-list` and never choose.
 */
import type { ImageProps } from "@expo/ui/swift-ui";
import type { ReactElement, ReactNode } from "react";

type SFSymbol = NonNullable<ImageProps["systemName"]>;

export interface RowAction {
	/** Stable across renders; also the accessibility action name. */
	key: string;
	/** Shown on the revealed button and in the menu, spoken as the custom action. */
	label: string;
	systemImage: SFSymbol;
	onPress: () => void;
	destructive?: boolean;
	/** `false` keeps a secondary action in the long-press menu only. */
	swipe?: boolean;
	/** Draws a divider after this action in the iOS menu. */
	dividerAfter?: boolean;
}

export interface InsetListProps {
	/** Section header above the group; the platform decides its case. */
	header?: string;
	/** One line of help under the group. */
	footer?: string;
	/** `InsetRow`s. Anything else is undefined behaviour on iOS. */
	children: ReactNode;
}

export interface InsetRowProps {
	leading?: { symbol: SFSymbol };
	title: string;
	secondary?: string;
	/** Trailing value, tabular. */
	value?: string;
	/** Custom trailing control; replaces the plain value. */
	trailing?: ReactElement;
	chevron?: boolean;
	/**
	 * The row opens a page outside the app (in-app browser); draws an
	 * up-forward arrow in place of the chevron.
	 */
	external?: boolean;
	/**
	 * What a press does when the title alone does not say, such as leaving the
	 * app for the browser. Spoken after the label.
	 */
	accessibilityHint?: string;
	/** Red title for a destructive row such as "Sign out". */
	destructive?: boolean;
	onPress?: () => void;
	/**
	 * Reachable by swipe, by long press and as screen-reader custom actions. The
	 * caller still owes a visible route to each of these somewhere.
	 */
	actions?: readonly RowAction[];
}

export function swipeActions(actions: readonly RowAction[]) {
	return actions.filter((action) => action.swipe !== false);
}

export function rowSpokenLabel({
	title,
	secondary,
}: Pick<InsetRowProps, "title" | "secondary">) {
	return secondary ? `${title}, ${secondary}` : title;
}
