import { AT_COURSE_METERS, pickerCourses } from "./course-picker-model";

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

	it("puts the course you are at above the home course", () => {
		// 51.6168, 4.8700 is on De Oosterhoutse (~180 m from its centre point
		// in the review); Welderen, the home course, is ~75 km away.
		const atOosterhout = { lat: 51.6168, lng: 4.87 };
		const r = pickerCourses(
			[
				...courses,
				{
					_id: "oo",
					name: "De Oosterhoutse",
					location: { lat: 51.6182, lng: 4.8686 },
				},
			],
			{ query: "", position: atOosterhout, homeCourseId: "w" },
		);
		expect(r[0]._id).toBe("oo");
		expect(r[0].distanceMeters).toBeLessThanOrEqual(AT_COURSE_METERS);
		expect(r.map((c) => c._id)).toEqual(["oo", "o", "w", "a", "x"]);
	});

	it("pins the home course when no course is within 2 km, or without a fix", () => {
		// ~2.5 km south of Oosterhoutse: nearby, but not on it.
		const outside = { lat: 51.6175, lng: 4.86 };
		expect(
			pickerCourses(courses, {
				query: "",
				position: outside,
				homeCourseId: "w",
			}).map((c) => c._id),
		).toEqual(["w", "o", "a", "x"]);
		expect(
			pickerCourses(courses, {
				query: "",
				position: null,
				homeCourseId: "w",
			}).map((c) => c._id),
		).toEqual(["w", "a", "o", "x"]);
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
