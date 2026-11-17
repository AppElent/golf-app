/** The native store is absent in Jest; a map lets a written value read back. */
jest.mock("expo-sqlite/kv-store", () => {
	const store = new Map<string, string>();
	return {
		__esModule: true,
		default: {
			getItemSync: (key: string) => store.get(key) ?? null,
			setItemSync: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItemSync: (key: string) => {
				store.delete(key);
			},
			getAllKeysSync: () => [...store.keys()],
			/** Tests only: start from an empty store. */
			__clear: () => store.clear(),
		},
	};
});
