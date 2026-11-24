import { type ReactNode, useMemo, useState } from "react";
import { type PlayerEdit, PlayerEditorContext } from "./use-player-editor";

export function PlayerEditorProvider({ children }: { children: ReactNode }) {
	const [edit, setEdit] = useState<PlayerEdit | null>(null);
	const value = useMemo(() => ({ edit, setEdit }), [edit]);
	return (
		<PlayerEditorContext.Provider value={value}>
			{children}
		</PlayerEditorContext.Provider>
	);
}
