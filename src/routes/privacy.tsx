import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "../components/LegalPage";

/** The privacy policy; App Store Connect and the phone app's Profile link here. */
export const Route = createFileRoute("/privacy")({
	head: () => ({ meta: [{ title: "Privacy policy · Fairway" }] }),
	component: Privacy,
});

const SECTIONS: readonly LegalSection[] = [
	{
		heading: "What we collect",
		paragraphs: [
			"Account: your email address and a password (stored hashed by our sign-in provider), or the name and email address shared by Apple, Google or Microsoft when you sign in with them, plus your sign-in sessions. This is an Appelent account, which also signs you in to other Appelent apps.",
			"Golf data: the rounds you play with their scores, putts, fairways and greens, the handicap index you enter, your home course, your clubs, courses you copy and edit, and the names and handicap indexes of guest players you add to a round. We use these to keep your scorecard, history and stats.",
			"Shot positions: when you mark a shot, its GPS position is saved with that round so Fairway can work out your club distances. Delete the round and its shots go with it.",
			"Course suggestions: the text of any correction you send about a course.",
			"Diagnostics: crash and error reports (device model, OS and app version, what went wrong) and, on the website, timing data for a sample of page loads. They never include your email address or name. Error reports and timing data from the website carry your account's internal ID, so we can see which errors hit the same person; reports from the phone app carry no account details.",
			"Problem reports: when you send one from the app, we receive your message and, only if you fill them in, the name and email address you enter so we can reply.",
		],
	},
	{
		heading: "Your location",
		paragraphs: [
			"The app uses your location to sort courses by distance and, during a round, to measure distances to the green, hazards and your target. These distances are worked out on your phone; your location is not stored or sent to us, except for shots you mark.",
			"If you turn on GPS while locked, Fairway keeps receiving your location in the background only while a round is open on the Play screen, so your distances are ready when you unlock. It stops when you leave that screen.",
		],
	},
	{
		heading: "How we use it",
		paragraphs: [
			"We use this data only to run Fairway: to sign you in, keep your rounds and stats, show distances and fix bugs. We do not sell your data, show ads or track you across other apps and websites.",
			"Sharing a round makes an image on your phone; it goes only where you send it.",
		],
	},
	{
		heading: "Who processes it",
		paragraphs: [
			"We rely on a few service providers that process data on our behalf: Clerk (accounts and sign-in, USA), Convex (app backend, EU), Cloudflare (web hosting) and Sentry (error reports, USA). Transfers outside the EU are covered by these providers' standard contractual clauses.",
			"On iPhone the hole maps come from Apple Maps, so Apple receives map requests for the area on screen under its own privacy policy. Course layouts come from OpenStreetMap data; nothing about you is sent there.",
		],
	},
	{
		heading: "How long we keep it",
		paragraphs: [
			"Your rounds, settings and clubs stay until you delete them or your account. Error reports are deleted within 90 days.",
		],
	},
	{
		heading: "Your choices and rights",
		paragraphs: [
			"You can delete a round at any time, and delete your account and all its data in the iPhone app under Profile → Delete account, or by emailing us. This deletes your Appelent account for every Appelent app.",
			"You may ask for a copy of your data, its correction or deletion, or object to its use, by emailing privacy@appelent.nl. You can also complain to your local data protection authority; in the Netherlands, the Autoriteit Persoonsgegevens.",
			"Fairway is not directed at children under 13 and we do not knowingly collect their personal data.",
		],
	},
	{
		heading: "Contact",
		paragraphs: [
			"Fairway is made by Appelent. Questions about this policy or your data: privacy@appelent.nl. If we change this policy, we update the date above.",
		],
	},
];

function Privacy() {
	return (
		<LegalPage
			title="Privacy policy"
			updated="Last updated: 12 November 2026"
			intro="Fairway is a golf companion for the web and iPhone: GPS distances on the course, a scorecard and your stats. This policy explains what we collect, why, and what you can do about it."
			sections={SECTIONS}
		/>
	);
}
