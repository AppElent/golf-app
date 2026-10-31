/**
 * What the app needs in place before any route can mount.
 *
 * `renderRouter` mounts `app/_layout.tsx` for real, and that layout constructs
 * a Convex client and asks Clerk whether anyone is signed in. Neither is what
 * these tests are about, so both get the smallest stub that lets the signed-in
 * shell render: an environment variable and a signed-in `useAuth`.
 *
 * The device stores are stubbed rather than mocked away. `expo-sqlite/kv-store`
 * gets a real in-memory map so a locale written by the language screen is read
 * back by the provider — that round trip is behaviour worth keeping, and losing
 * it would make the language tests prove less than they appear to.
 */

// `src/convex/provider.tsx` throws at module load without this. The value is
// never dialled: no test asserts on Convex data.
process.env.EXPO_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_jest";

// Gesture Handler 3 installs UI-runtime bindings at import time, but Worklets'
// web build (the one Jest resolves) throws from `getUIRuntimeHolder`.
jest.mock("react-native-worklets", () => ({
	...jest.requireActual("react-native-worklets"),
	getUIRuntimeHolder: () => ({}),
}));

// UIKit renders native header items outside React's test tree. Expose their
// public callbacks and accessibility state without mocking the navigation stack.
jest.mock(
	"react-native-screens/lib/commonjs/components/ScreenStackHeaderConfig",
	() => {
		const actual = jest.requireActual(
			"react-native-screens/lib/commonjs/components/ScreenStackHeaderConfig",
		);
		const React = jest.requireActual("react");
		const { Pressable, Text, View } = jest.requireActual("react-native");
		return {
			...actual,
			ScreenStackHeaderConfig: React.forwardRef(
				(
					props: import("react-native-screens").ScreenStackHeaderConfigProps,
					ref: unknown,
				) =>
					React.createElement(
						View,
						{ ref },
						props.children,
						props.title && !props.hidden
							? React.createElement(
									Text,
									{ accessibilityRole: "header" },
									props.title,
								)
							: null,
						...[
							...(props.headerLeftBarButtonItems ?? []),
							...(props.headerRightBarButtonItems ?? []),
						]
							.filter((item) => item.type === "button" || item.type === "menu")
							.flatMap((item, index) =>
								item.type === "button"
									? [
											React.createElement(Pressable, {
												key: index,
												accessibilityRole: "button",
												accessibilityLabel:
													item.accessibilityLabel ?? item.title,
												accessibilityState: {
													disabled: item.disabled ?? false,
												},
												disabled: item.disabled,
												onPress: item.onPress,
											}),
										]
									: // A native menu: its trigger, then its actions as plain rows.
										[
											React.createElement(Pressable, {
												key: index,
												accessibilityRole: "button",
												accessibilityLabel:
													item.accessibilityLabel ?? item.title,
											}),
											...(item.menu?.items ?? []).map(
												(
													action: { title?: string; onPress?: () => void },
													actionIndex: number,
												) =>
													React.createElement(
														Pressable,
														{
															key: `${index}-${actionIndex}`,
															accessibilityRole: "menuitem",
															onPress: action.onPress,
														},
														React.createElement(Text, null, action.title),
													),
											),
										],
							),
					),
			),
		};
	},
);


// Expo UI is native-only. These thin host shims keep tests focused on the
// React contract (callbacks, roles and presentation options), not SwiftUI.
jest.mock("@expo/ui/swift-ui", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Pressable, Text, View } = jest.requireActual("react-native");
	const Container = ({ children, ...props }: { children?: React.ReactNode }) =>
		React.createElement(View, props, children);
	const Actions = ({ children, ...props }: { children?: React.ReactNode }) =>
		React.createElement(
			View,
			{ ...props, testID: "swiftui-swipe-actions" },
			children,
		);
	const SwipeActions = Object.assign(Container, { Actions });
	// (No local type alias here: babel-plugin-jest-hoist rejects it as an
	// out-of-scope reference.)
	const modifierArg = (
		modifiers: { type: string; args: unknown[] }[] | undefined,
		type: string,
	) => modifiers?.find((modifier) => modifier.type === type)?.args[0];
	// A SwiftUI stack whose `onTapGesture` / `accessibilityLabel` modifiers
	// are honoured, so a row built from stacks is pressable and findable.
	const Stack = ({
		children,
		modifiers,
		...props
	}: {
		children?: React.ReactNode;
		modifiers?: { type: string; args: unknown[] }[];
	}) => {
		const onPress = modifierArg(modifiers, "onTapGesture") as
			| (() => void)
			| undefined;
		const label = modifierArg(modifiers, "accessibilityLabel") as
			| string
			| undefined;
		return React.createElement(
			onPress ? Pressable : View,
			{
				...props,
				onPress,
				accessibilityLabel: label,
				accessibilityRole: onPress ? "button" : undefined,
			},
			children,
		);
	};
	const PopoverContent = ({ children }: { children?: React.ReactNode }) =>
		React.createElement(View, null, children);
	const ContextMenu = Object.assign(
		({ children }: { children?: React.ReactNode }) =>
			React.createElement(View, { testID: "swiftui-context-menu" }, children),
		{
			Items: ({ children }: { children?: React.ReactNode }) =>
				React.createElement(
					View,
					{ testID: "swiftui-context-menu-items" },
					children,
				),
			Trigger: Container,
			Preview: () => null,
		},
	);
	return {
		Chart: ({
			type,
			data,
		}: {
			type?: string;
			data: { x: unknown; y: number }[];
		}) => React.createElement(View, { testID: `swiftui-chart-${type}`, data }),
		ContentUnavailableView: ({
			title,
			description,
			systemImage,
		}: {
			title?: string;
			description?: string;
			systemImage?: string;
		}) =>
			React.createElement(
				View,
				{ testID: "swiftui-content-unavailable", systemImage },
				title ? React.createElement(Text, null, title) : null,
				description ? React.createElement(Text, null, description) : null,
			),
		Popover: Object.assign(
			({
				children,
				isPresented,
			}: {
				children?: React.ReactNode;
				isPresented?: boolean;
			}) =>
				React.createElement(
					View,
					null,
					React.Children.toArray(children).filter(
						(child: React.ReactNode) =>
							isPresented ||
							!React.isValidElement(child) ||
							child.type !== PopoverContent,
					),
				),
			{ Trigger: Container, Content: PopoverContent },
		),
		ContextMenu,
		Gauge: ({
			value,
			max,
			currentValueLabel,
			modifiers,
		}: {
			value: number;
			max?: number;
			currentValueLabel?: React.ReactNode;
			modifiers?: { type: string; args: unknown[] }[];
		}) =>
			React.createElement(
				View,
				{
					testID: "swiftui-gauge",
					accessibilityLabel: modifierArg(modifiers, "accessibilityLabel"),
					accessibilityValue: { now: value, max },
				},
				currentValueLabel,
			),
		HStack: Stack,
		List: Stack,
		RoundedRectangle: Container,
		Section: ({
			title,
			footer,
			children,
		}: {
			title?: string;
			footer?: React.ReactNode;
			children?: React.ReactNode;
		}) =>
			React.createElement(
				View,
				{ testID: "swiftui-section" },
				title ? React.createElement(Text, null, title) : null,
				children,
				footer ?? null,
			),
		Spacer: Container,
		Text: ({
			children,
			modifiers,
		}: {
			children?: React.ReactNode;
			modifiers?: { type: string; args: unknown[] }[];
		}) => React.createElement(Text, { modifiers }, children),
		VStack: Stack,
		ZStack: Stack,
		// Like SwiftUI, dismissal is reported once the sheet has gone.
		BottomSheet: function BottomSheet({
			children,
			anchor,
			isPresented,
			onDismiss,
		}: {
			children?: React.ReactNode;
			anchor?: React.ReactNode;
			isPresented: boolean;
			onDismiss?: () => void;
		}) {
			const shown = React.useRef(isPresented);
			React.useEffect(() => {
				if (shown.current && !isPresented) onDismiss?.();
				shown.current = isPresented;
			}, [isPresented, onDismiss]);
			return React.createElement(
				View,
				null,
				anchor,
				isPresented ? children : null,
			);
		},
		Toggle: ({
			label,
			isOn,
			onIsOnChange,
			modifiers,
			children,
		}: {
			label?: string;
			isOn?: boolean;
			onIsOnChange?: (value: boolean) => void;
			modifiers?: { type: string; args: unknown[] }[];
			children?: React.ReactNode;
		}) =>
			React.createElement(
				Pressable,
				{
					accessibilityRole: "checkbox",
					accessibilityLabel: label,
					accessibilityState: { checked: isOn },
					disabled: Boolean(modifierArg(modifiers, "disabled")),
					onPress: () => onIsOnChange?.(!isOn),
				},
				label === undefined ? children : React.createElement(Text, null, label),
			),
		Button: ({
			label,
			children,
			onPress,
			role,
		}: {
			label?: string;
			children?: React.ReactNode;
			onPress?: () => void;
			role?: string;
		}) =>
			React.createElement(
				Pressable,
				{
					accessibilityLabel: label,
					accessibilityRole: "button",
					onPress,
					testID: role ? `swiftui-button-${role}` : undefined,
				},
				children ?? React.createElement(Text, null, label),
			),
		// The system date picker. Jest cannot draw a month grid, so the mock
		// exposes the one thing a test needs: the selected date in, and a
		// `dateChange` event out.
		DatePicker: ({
			title,
			selection,
			onDateChange,
			modifiers,
		}: {
			title?: string;
			selection?: Date;
			onDateChange?: (date: Date) => void;
			modifiers?: { type: string; args: unknown[] }[];
		}) =>
			React.createElement(View, {
				testID: "swiftui-date-picker",
				accessibilityLabel:
					modifierArg(modifiers, "accessibilityLabel") ?? title,
				selection,
				onDateChange,
			}),
		Divider: Container,
		Group: ({
			children,
			modifiers,
		}: {
			children?: React.ReactNode;
			modifiers?: unknown;
		}) =>
			React.createElement(
				View,
				{ modifiers, testID: "swiftui-group" },
				children,
			),
		Host: Container,
		Label: ({
			title,
			children,
		}: {
			title?: string;
			children?: React.ReactNode;
		}) => React.createElement(Text, null, title, children),
		Image: ({ systemName }: { systemName?: string }) =>
			React.createElement(Text, null, systemName),
		Menu: ({
			label,
			children,
			modifiers,
		}: {
			label: React.ReactNode;
			children?: React.ReactNode;
			modifiers?: { type: string; args: unknown[] }[];
		}) => {
			const [open, setOpen] = React.useState(false);
			const spokenLabel = modifiers?.find(
				(modifier) => modifier.type === "accessibilityLabel",
			)?.args[0];
			return React.createElement(
				View,
				null,
				React.createElement(
					Pressable,
					{
						accessibilityLabel: spokenLabel,
						accessibilityRole: "button",
						disabled: Boolean(modifierArg(modifiers, "disabled")),
						accessibilityState: {
							disabled: Boolean(modifierArg(modifiers, "disabled")),
						},
						onPress: () => setOpen(true),
					},
					label,
				),
				open ? children : null,
			);
		},
		// A segmented control: each tagged child is a pressable option; the
		// selected one carries `accessibilityState.selected`.
		Picker: ({
			selection,
			onSelectionChange,
			children,
			modifiers,
		}: {
			modifiers?: unknown;
			selection?: unknown;
			onSelectionChange?: (next: unknown) => void;
			children?: React.ReactNode;
		}) =>
			React.createElement(
				View,
				{
					testID: "swiftui-picker",
					accessibilityRole: "radiogroup",
					modifiers,
					onSelectionChange,
				},
				React.Children.map(children, (child: React.ReactNode) => {
					if (!React.isValidElement(child)) return child;
					const props = (
						child as React.ReactElement<{
							modifiers?: { type: string; args: unknown[] }[];
							children?: React.ReactNode;
						}>
					).props;
					const value = modifierArg(props.modifiers, "tag");
					const label = modifierArg(props.modifiers, "accessibilityLabel");
					return React.createElement(
						Pressable,
						{
							accessibilityRole: "radio",
							accessibilityLabel: label ?? props.children,
							accessibilityState: { selected: value === selection },
							onPress: () => onSelectionChange?.(value),
						},
						React.createElement(Text, null, props.children),
					);
				}),
			),
		RNHostView: Container,
		SwipeActions,
	};
});

// Every modifier becomes `{ type, args }`; nested namespaces (`shapes.rectangle()`)
// resolve the same way with a dotted type, so a component can assert on them.
jest.mock("@expo/ui/swift-ui/modifiers", () => {
	const modifier = (path: string): unknown =>
		new Proxy(() => undefined, {
			get: (_target, name) =>
				modifier(path ? `${path}.${String(name)}` : String(name)),
			apply: (_target, _thisArg, args: unknown[]) => ({ type: path, args }),
		});
	return modifier("");
});

// UIKit's menu host is absent in Jest. Keep Expo's real Link, routing and menu
// declarations; drive only the native presentation/selection boundary here.
jest.mock("expo-router/build/link/preview/native", () => {
	const React = jest.requireActual("react");
	const { View, Text, Pressable } = jest.requireActual("react-native");
	const MenuContext = React.createContext(null);
	return {
		...jest.requireActual("expo-router/build/link/preview/native"),
		NativeLinkPreview: ({ children }: { children: React.ReactNode }) => {
			const [open, setOpen] = React.useState(false);
			return React.createElement(
				MenuContext.Provider,
				{ value: { open, setOpen } },
				React.createElement(
					View,
					{ onLongPress: () => setOpen(true) },
					children,
				),
			);
		},
		NativeLinkPreviewAction: ({
			children,
			title,
			onSelected,
		}: {
			children?: React.ReactNode;
			title: string;
			onSelected: () => void;
		}) => {
			const menu = React.useContext(MenuContext);
			if (!menu?.open) return null;
			if (children)
				return React.createElement(
					View,
					null,
					React.createElement(Text, null, title),
					children,
					React.createElement(
						Pressable,
						{ accessibilityLabel: "Close", onPress: () => menu.setOpen(false) },
						React.createElement(Text, null, "Close"),
					),
				);
			return React.createElement(
				Pressable,
				{
					accessibilityRole: "button",
					accessibilityLabel: title,
					onPress: () => {
						menu.setOpen(false);
						onSelected();
					},
				},
				React.createElement(Text, null, title),
			);
		},
	};
});

jest.mock("@clerk/expo", () => ({
	ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
	useAuth: () => ({
		isLoaded: true,
		isSignedIn: true,
		userId: "test-user",
		signOut: jest.fn(),
		getToken: jest.fn().mockResolvedValue(null),
	}),
	useUser: () => ({ isLoaded: true, isSignedIn: true, user: null }),
}));

jest.mock("@clerk/expo/token-cache", () => ({ tokenCache: undefined }));

// Screen/save tests use the existing mocked Convex transport. Cache lifecycle
// tests unmock this boundary and exercise the real helper and subscription hooks.
jest.mock("./src/convex/query-cache", () => {
	const convex = jest.requireMock("convex/react");
	return {
		AppQueryCacheProvider: ({ children }: { children: React.ReactNode }) =>
			children,
		useQuery: (...args: unknown[]) => convex.useQuery(...args),
		useQueries: (...args: unknown[]) => convex.useQueries(...args),
		usePaginatedQuery: (...args: unknown[]) =>
			convex.usePaginatedQuery(...args),
		// The real hook, over the mocked `usePaginatedQuery`.
		usePausablePaginatedQuery: (...args: unknown[]) =>
			jest
				.requireActual("./src/convex/query-cache")
				.usePausablePaginatedQuery(...args),
	};
});

jest.mock("convex/react", () => {
	const emptyQueryResult: never[] = [];
	const emptyDiary = { entries: [], totals: {} };
	const emptyGoalHistory = {
		goals: [],
		basis: "reference",
		effectiveFrom: null,
	};
	const { getFunctionName } = jest.requireActual("convex/server");
	return {
		...jest.requireActual("convex/react"),
		useQueries: jest.fn((queries) =>
			Object.fromEntries(
				Object.keys(queries).map((key) => [
					key,
					{ items: [], cursor: null, isDone: true },
				]),
			),
		),
		useQuery: jest.fn((reference) =>
			getFunctionName(reference) === "nutritionDiary:day"
				? emptyDiary
				: getFunctionName(reference) === "nutritionGoals:forDate"
					? emptyGoalHistory
					: emptyQueryResult,
		),
		// The training marker's own, non-throwing query form (see
		// `src/data/training-marker.ts`). Defaults to "no completed Activity
		// found" so every existing screen test keeps its current behaviour;
		// marker-specific tests override this per case.
		useQuery_experimental: jest.fn(() => ({
			status: "success" as const,
			data: false,
		})),
		useMutation: jest.fn(() => jest.fn().mockResolvedValue(undefined)),
		// AI entry actions; screen tests script answers per case.
		useAction: jest.fn(() => jest.fn().mockResolvedValue(undefined)),
		useConvex: jest.fn(() => ({ query: jest.fn().mockResolvedValue([]) })),
		usePaginatedQuery: jest.fn(() => ({
			results: [],
			status: "Exhausted",
			loadMore: jest.fn(),
		})),
		// Connected by default, so every existing test keeps the behaviour it
		// was written against. The Nutrition day reads this to tell "still
		// loading" apart from "will never load because the socket is down", and
		// the offline tests override it per case.
		useConvexConnectionState: jest.fn(() => ({
			isWebSocketConnected: true,
			hasInflightRequests: false,
			hasEverConnected: true,
			connectionCount: 1,
			connectionRetries: 0,
			timeOfOldestInflightRequest: null,
			inflightMutations: 0,
			inflightActions: 0,
		})),
	};
});


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
		},
	};
});

// A device set to English, so a test that expects Dutch has to have asked for
// it rather than inheriting it from whoever is running the suite.
jest.mock("expo-localization", () => ({
	getLocales: () => [{ languageTag: "en-GB", languageCode: "en" }],
}));

/**
 * React 19 reports an error an error boundary recovered from by dispatching a
 * global `ErrorEvent`. jest-expo's environment supplies a `window` with an
 * `ErrorEvent` constructor but no `dispatchEvent`, so React's own reporting
 * throws and buries the error the boundary was busy handling. A no-op restores
 * the real behaviour under test: the boundary renders, and retry works.
 */
const maybeWindow = (globalThis as { window?: { dispatchEvent?: unknown } })
	.window;
if (maybeWindow && typeof maybeWindow.dispatchEvent !== "function") {
	maybeWindow.dispatchEvent = () => true;
}

// Native bottom toolbar items expose their public selection callback in Jest.
jest.mock("expo-router/build/toolbar/native", () => {
	const React = jest.requireActual("react");
	const { View, Pressable, Text } = jest.requireActual("react-native");
	return {
		RouterToolbarHost: ({ children }: { children?: React.ReactNode }) =>
			React.createElement(View, null, children),
		RouterToolbarItem: (
			props: import("expo-router/build/toolbar/native.types").RouterToolbarItemProps,
		) =>
			props.hidden
				? null
				: props.children
					? React.createElement(View, null, props.children)
					: React.createElement(
							Pressable,
							{
								accessibilityRole: "button",
								accessibilityLabel: props.accessibilityLabel ?? props.title,
								disabled: props.disabled,
								accessibilityState: { disabled: props.disabled ?? false },
								onPress: props.onSelected,
							},
							props.title ? React.createElement(Text, null, props.title) : null,
						),
	};
});
