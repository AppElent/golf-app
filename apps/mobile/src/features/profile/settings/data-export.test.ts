import { Share } from "react-native";
import { shareDataExport } from "./data-export";

const written: { uri: string; text: string }[] = [];
jest.mock("expo-file-system", () => {
	class Directory {
		uri: string;
		exists = false;
		constructor(parent: { uri: string }, name: string) {
			this.uri = `${parent.uri}/${name}`;
		}
		delete() {}
		create() {}
	}
	class File {
		uri: string;
		constructor(dir: { uri: string }, name: string) {
			this.uri = `${dir.uri}/${name}`;
		}
		create() {}
		write(text: string) {
			written.push({ uri: this.uri, text });
		}
	}
	return { Directory, File, Paths: { cache: { uri: "file:///cache" } } };
});

beforeEach(() => {
	jest.restoreAllMocks();
	written.length = 0;
	jest.spyOn(Share, "share").mockResolvedValue({
		action: "sharedAction",
		activityType: undefined,
	});
});

it("writes every page to one JSON file and shares the file", async () => {
	const fetchPage = jest
		.fn()
		.mockResolvedValueOnce({
			tables: { clubs: [{ _id: "c1" }] },
			catalog: { courses: [], tees: [] },
			next: { table: "rounds", cursor: null },
		})
		.mockResolvedValueOnce({
			tables: { rounds: [{ _id: "r1" }] },
			catalog: { courses: [], tees: [] },
			next: null,
		});

	await shareDataExport(fetchPage);

	expect(fetchPage).toHaveBeenCalledTimes(2);
	expect(written).toHaveLength(1);
	expect(written[0].uri).toMatch(
		/^file:\/\/\/cache\/data-export\/fairway-data-\d{4}-\d{2}-\d{2}\.json$/,
	);
	expect(JSON.parse(written[0].text)).toMatchObject({
		format: "fairway-data-export",
		tables: { clubs: [{ _id: "c1" }], rounds: [{ _id: "r1" }] },
	});
	expect(Share.share).toHaveBeenCalledWith({ url: written[0].uri });
});

it("shares nothing when a page fails", async () => {
	const fetchPage = jest.fn().mockRejectedValue(new Error("offline"));
	await expect(shareDataExport(fetchPage)).rejects.toThrow("offline");
	expect(Share.share).not.toHaveBeenCalled();
});
