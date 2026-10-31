import { pickerCourses } from "./course-picker-model";

const courses = [
	{
		_id: "a",
		name: "Amsterdamse",
		city: "Amsterdam",
		location: { lat: 52.37, lng: 4.9 },
	},
	{
		_id: "o",
		name: "Oosterhoutse",
		city: "Oosterhout",
		location: { lat: 51.64, lng: 4.86 },
	},
	{
		_id: "w",
		name: "Welderen",
		city: "Elst",
		location: { lat: 51.92, lng: 5.83 },
	},
	{ _id: "x", name: "Zéland" },
];

describe("pickerCourses", () => {
	it("keeps delivered order without a fix", () => {
		const r = pickerCourses(courses, {
			query: "",
			position: null,
			homeCourseId: null,
		});
		expect(r.map((c) => c._id)).toEqual(["a", "o", "w", "x"]);
	});

	it("sorts nearest first and lifts the home course to the top", () => {
		const nearElst = { lat: 51.9, lng: 5.8 };
		expect(
			pickerCourses(courses, {
				query: "",
				position: nearElst,
				homeCourseId: null,
			}).map((c) => c._id),
		).toEqual(["w", "o", "a", "x"]);
		expect(
			pickerCourses(courses, {
				query: "",
				position: nearElst,
				homeCourseId: "a",
			}).map((c) => c._id),
		).toEqual(["a", "w", "o", "x"]);
	});

	it("matches name or city ignoring case and accents", () => {
		const find = (query: string) =>
			pickerCourses(courses, { query, position: null, homeCourseId: null }).map(
				(c) => c._id,
			);
		expect(find("elst")).toEqual(["w"]);
		expect(find("zel")).toEqual(["x"]);
		expect(find("hout")).toEqual(["o"]);
	});
});
