import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { MapPin, Pencil } from "lucide-react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/courses/")({ component: CoursesScreen });

function CoursesScreen() {
	const courses = useQuery(api.courses.list);

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Courses
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				Seeded from OpenStreetMap. Tap a course to fill in par, stroke index,
				and tee ratings.
			</p>

			{courses === undefined ? (
				<p className="mt-8 text-[13px] text-stone">Loading…</p>
			) : courses.length === 0 ? (
				<p className="mt-8 text-[13px] text-stone">
					No courses yet — run the seed action to import your home courses.
				</p>
			) : (
				<ul className="mt-6 flex flex-col gap-3">
					{courses.map((course) => (
						<li key={course._id}>
							<Link
								to="/courses/$courseId/edit"
								params={{ courseId: course._id }}
								className="flex items-center justify-between rounded-2xl border border-card-line bg-white/60 px-4 py-4 shadow-sm"
							>
								<span>
									<span className="block font-display text-[17px] font-semibold text-ink">
										{course.name}
									</span>
									{course.city ? (
										<span className="mt-0.5 flex items-center gap-1 text-[12px] text-moss">
											<MapPin className="size-3.5" />
											{course.city}
										</span>
									) : null}
								</span>
								<Pencil className="size-4 text-live" />
							</Link>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
