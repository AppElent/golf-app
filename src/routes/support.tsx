import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "../components/LegalPage";

/** Support page; App Store Connect links here as the support URL. */
export const Route = createFileRoute("/support")({
	head: () => ({ meta: [{ title: "Support · Fairway" }] }),
	component: Support,
});

const SECTIONS: readonly LegalSection[] = [
	{
		heading: "Contact",
		paragraphs: [
			"Email privacy@appelent.nl with your question, the device you use and, if something went wrong, what you were doing. In the app, Profile → Report a problem sends us a report with the technical details.",
		],
	},
	{
		heading: "Distances",
		paragraphs: [
			"Distances follow your GPS once you are on the hole you are playing. Off the hole, or without a GPS fix, Fairway measures from the tee.",
			"To try a course from home, open Profile → Course simulator. A simulated round never counts for your history, stats or handicap.",
		],
	},
	{
		heading: "Courses",
		paragraphs: [
			"Course data is the same for everyone and checked against the club's scorecard. Spotted a mistake? In round setup, tap Suggest a correction.",
		],
	},
	{
		heading: "Your account",
		paragraphs: [
			"Delete a round from its detail screen. Delete your account and all its data under Profile → Delete account. See the privacy policy at fairway.appelent.nl/privacy.",
		],
	},
];

function Support() {
	return (
		<LegalPage
			title="Fairway support"
			intro="Fairway is a golf companion: GPS distances to the green and hazards, a scorecard for stroke play or Stableford, and stats from your rounds."
			sections={SECTIONS}
		/>
	);
}
