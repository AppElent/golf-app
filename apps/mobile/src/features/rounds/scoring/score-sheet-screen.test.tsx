import { fireEvent, render, screen } from "@testing-library/react-native";
import { LocaleProvider } from "../../../i18n";
import { AppearanceProvider } from "../../../theme";
import { useActiveRound } from "../use-active-round";
import { ScoreSheetScreen } from "./score-sheet-screen";

const mockSaveHole = jest.fn((_args: unknown) => Promise.resolve());
const mockRouter = { back: jest.fn(), replace: jest.fn() };
let mockHole = "0";

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
		useLocalSearchParams: () => ({ hole: mockHole }),
		useRouter: () => mockRouter,
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
	return mockSaveHole.mock.calls[0][0] as { scores: unknown[] };
}

beforeEach(() => {
	mockSaveHole.mockClear();
	mockRouter.back.mockClear();
	mockRouter.replace.mockClear();
	mockHole = "0";
});

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

describe("another device changing another field of a card touched here (APP-924)", () => {
	it("saves the putts tapped here without the strokes stored there", async () => {
		await openWhile({ strokes: 4 }, { strokes: 6 });
		await fireEvent.press(
			screen.getByRole("button", { name: "Increase Putts" }),
		);
		const { scores } = await savedScores();
		expect(scores).toEqual([{ playerIndex: 0, putts: 2, gir: false }]);
	});

	it("keeps the putts stored there when the strokes change here", async () => {
		await openWhile({ strokes: 4 }, { strokes: 4, putts: 3 });
		await fireEvent.press(screen.getByRole("radio", { name: "5" }));
		const { scores } = await savedScores();
		// GIR follows the stored putts: 5 strokes, 3 putts on a par 4.
		expect(scores).toEqual([
			{ playerIndex: 0, strokes: 5, nr: false, gir: true },
		]);
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
	// The putts stored there stay: only the starting par is written.
	const { scores } = await savedScores();
	expect(scores).toEqual([
		{ playerIndex: 0, strokes: 4, nr: false, gir: true },
	]);
});

describe("a round started on hole 10 (APP-914)", () => {
	const holes = Array.from({ length: 18 }, (_, i) => ({
		ref: String(i + 1),
		par: 4,
		strokeIndex: i + 1,
	}));
	/** The owner's scores on these holes, entered in this order. */
	function playing(order: readonly number[], holeIndex: number) {
		mockHole = String(holeIndex);
		jest.mocked(useActiveRound).mockReturnValue({
			round: {
				_id: "round",
				format: "stroke",
				currentHoleIndex: holeIndex,
				players: [{ name: "Eric" }],
			},
			holes,
			scores: order.map((hole, i) => ({
				holeIndex: hole,
				playerIndex: 0,
				strokes: 4,
				_creationTime: 1000 + i,
			})),
		} as unknown as ReturnType<typeof useActiveRound>);
	}
	const front9 = [0, 1, 2, 3, 4, 5, 6, 7, 8];
	const back9 = [9, 10, 11, 12, 13, 14, 15, 16, 17];

	it("plays hole 1 after hole 18", async () => {
		playing(back9.slice(0, -1), 17);
		await render(sheet());
		expect(await savedScores()).toMatchObject({ holeIndex: 17, advanceTo: 0 });
		expect(mockRouter.replace).not.toHaveBeenCalled();
		expect(mockRouter.back).toHaveBeenCalled();
	});

	it("ends the round after hole 9", async () => {
		playing([...back9, ...front9.slice(0, -1)], 8);
		await render(sheet());
		const saved = await savedScores();
		expect(saved).toMatchObject({ holeIndex: 8 });
		expect(saved).not.toHaveProperty("advanceTo");
		expect(mockRouter.replace).toHaveBeenCalledWith("/scorecard");
	});

	it("still ends a round started on hole 1 after hole 18", async () => {
		playing([...front9, ...back9.slice(0, -1)], 17);
		await render(sheet());
		expect(await savedScores()).not.toHaveProperty("advanceTo");
		expect(mockRouter.replace).toHaveBeenCalledWith("/scorecard");
	});
});
