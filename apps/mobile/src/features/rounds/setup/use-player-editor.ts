import { createContext, useContext } from "react";

export interface PlayerDraft {
	name: string;
	index: string;
}

/** What the `Speler` sheet edits, handed over by the setup screen below it. */
export interface PlayerEdit {
	initial: PlayerDraft;
	/** The account owner's name comes from the account. */
	nameLocked: boolean;
	/** Shown while the name is empty, and used when it stays empty. */
	namePlaceholder: string;
	/** The line under the fields for a typed index. */
	footer: (index: string) => string;
	onSave: (draft: PlayerDraft) => void;
	/** Only for a guest already in the round. */
	onRemove?: () => void;
}

/**
 * The setup screen owns the players; its sheet is a route, so the edit in
 * progress travels through this context. In memory on purpose: a restored sheet
 * without a setup screen has nothing to edit.
 */
export const PlayerEditorContext = createContext<{
	edit: PlayerEdit | null;
	setEdit: (edit: PlayerEdit) => void;
}>({ edit: null, setEdit: () => {} });

export function usePlayerEditor() {
	return useContext(PlayerEditorContext);
}
