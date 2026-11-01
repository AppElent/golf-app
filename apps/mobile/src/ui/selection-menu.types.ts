export type SelectionMenuProps = {
	label: string;
	accessibilityLabel: string;
	disabled?: boolean;
	/** An icon-only menu still has an explicit accessible name. */
	trigger?: "ellipsis";
	groups: readonly {
		title?: string;
		options: readonly {
			id: string;
			label: string;
			selected?: boolean;
			emphasized?: boolean;
			symbol?: "plus";
			disabled?: boolean;
			destructive?: boolean;
		}[];
	}[];
	onSelect: (id: string) => void;
};
