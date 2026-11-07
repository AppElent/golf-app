import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ChevronRight, MapPin, Pencil } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { SURFACE } from "../components/classes";
import { Page, PageTitle } from "../components/Page";

export const Route = createFileRoute("/courses/")({ component: CoursesScreen });

function CoursesScreen() {
	const courses = useQuery(api.courses.list);

	return (
		<Page>
			<PageTitle>Courses</PageTitle>
			<p className="mt-1 text-[13px] text-moss">
				The course catalog is checked against each club's scorecard. Make your
				own copy to change a course, or suggest a correction.
			</p>

			{courses === undefined ? (
				<p className="mt-8 text-[13px] text-stone">Loading…</p>
			) : courses.length === 0 ? (
				<p className="mt-8 text-[13px] text-stone">
					No courses yet — run the seed action to sync the course catalog.
				</p>
			) : (
				<ul className="mt-6 flex flex-col gap-3">
					{courses.map((course) => (
						<li key={course._id}>
							<Link
								to="/courses/$courseId/edit"
								params={{ courseId: course._id }}
								className={`flex items-center justify-between rounded-2xl border ${SURFACE} px-4 py-4 shadow-sm`}
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
								{course.ownerId ? (
									<span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-live">
										My copy
										<Pencil className="size-4" />
									</span>
								) : (
									<ChevronRight className="size-4 text-moss" />
								)}
							</Link>
						</li>
					))}
				</ul>
			)}
		</Page>
	);
}
