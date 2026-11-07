/** The native store is absent in Jest; a map lets a written preference read back. */
jest.mock("expo-sqlite/kv-store", () => {
	const store = new Map<string, string>();
	return {
		__esModule: true,
		default: {
			getItemSync: (key: string) => store.get(key) ?? null,
			setItemSync: (key: string, value: string) => {
				store.set(key, value);
			},
		},
	};
});
