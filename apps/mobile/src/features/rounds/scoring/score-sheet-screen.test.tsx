import { fireEvent, render, screen } from "@testing-library/react-native";
import { LocaleProvider } from "../../../i18n";
import { AppearanceProvider } from "../../../theme";
import { useActiveRound } from "../use-active-round";
import { ScoreSheetScreen } from "./score-sheet-screen";

const mockSaveHole = jest.fn((_args: unknown) => Promise.resolve());

jest.mock("convex/react", () => ({ useMutation: () => mockSaveHole }));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../use-active-round", () => ({ useActiveRound: jest.fn() }));
jest.mock("../../profile/use-units", () => ({ useUnits: () => "meters" }));
jest.mock("./use-finish-round", () => ({
	useFinishRound: () => ({ pending: false, error: null }),
}));
jest.mock("../../../ui/nav-header", () => ({ NavHeader: () => null }));
jest.mock("expo-router", () => {
	const { Pressable, Text } =
		jest.requireActual<typeof import("react-native")>("react-native");
	const Toolbar = ({ children }: { children: React.ReactNode }) => children;
	Toolbar.Button = ({
		children,
		onPress,
	}: {
		children: string;
		onPress: () => void;
	}) => (
		<Pressable accessibilityRole="button" onPress={onPress}>
			<Text>{children}</Text>
		</Pressable>
	);
	return {
		Stack: { Screen: () => null, Toolbar },
		useLocalSearchParams: () => ({ hole: "0" }),
		useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
	};
});

type Stored = {
	strokes?: number;
	putts?: number;
	penalties?: number;
	nr?: boolean;
};

/** The round as Convex has it now, with the owner's score on hole 1. */
function stored(own?: Stored) {
	jest.mocked(useActiveRound).mockReturnValue({
		round: {
			_id: "round",
			format: "stroke",
			currentHoleIndex: 1,
			players: [{ name: "Eric" }],
		},
		holes: [1, 2, 3].map((n) => ({ ref: String(n), par: 4, strokeIndex: n })),
		scores: own ? [{ holeIndex: 0, playerIndex: 0, ...own }] : [],
	} as unknown as ReturnType<typeof useActiveRound>);
}

const sheet = () => (
	<AppearanceProvider>
		<LocaleProvider>
			<ScoreSheetScreen />
		</LocaleProvider>
	</AppearanceProvider>
);

/** Opens the sheet on `before`; another device then stores `after`. */
async function openWhile(before: Stored | undefined, after?: Stored) {
	stored(before);
	const { rerender } = await render(sheet());
	stored(after);
	await rerender(sheet());
}

async function savedScores() {
	await fireEvent.press(screen.getByRole("button", { name: "Save" }));
	expect(mockSaveHole).toHaveBeenCalledTimes(1);
	return mockSaveHole.mock.calls[0][0];
}

beforeEach(() => mockSaveHole.mockClear());

describe("another device scoring the owner while the sheet is open (APP-916)", () => {
	it.each([
		["changed a score", { strokes: 4 }, { strokes: 6, putts: 2, penalties: 1 }],
		["picked up", { strokes: 4 }, { strokes: 4, nr: true }],
		["scored first", undefined, { strokes: 6, putts: 2 }],
	])("keeps what it stored when it %s", async (_, before, after) => {
		await openWhile(before, after);
		expect(await savedScores()).toMatchObject({ scores: [] });
	});

	it("shows what it stored", async () => {
		await openWhile({ strokes: 4 }, { strokes: 6 });
		expect(screen.getByLabelText("Strokes: 6")).toBeTruthy();
	});

	it("saves a card changed here", async () => {
		await openWhile({ strokes: 4 }, { strokes: 6 });
		await fireEvent.press(screen.getByRole("radio", { name: "5" }));
		expect(await savedScores()).toMatchObject({
			scores: [{ playerIndex: 0, strokes: 5 }],
		});
	});
});

it("saves the starting par of an untouched hole without a result", async () => {
	await openWhile(undefined);
	expect(await savedScores()).toMatchObject({
		scores: [{ playerIndex: 0, strokes: 4 }],
	});
});

it("saves the starting par over a row without a result", async () => {
	await openWhile({ putts: 2, nr: false }, { putts: 2, nr: false });
	expect(await savedScores()).toMatchObject({
		scores: [{ playerIndex: 0, strokes: 4, putts: 2 }],
	});
});
