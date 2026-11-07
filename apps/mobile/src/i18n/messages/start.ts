/** Home, course picker and round setup. */
export const homeEn = {
	title: "Fairway",
	handicap: "Handicap index",
	handicapUnset: "Not set",
	handicapUnsetHint: "Add it for your playing handicap and net scores.",
	wouldBe: "Would-be index {value}",
	wouldBeHint: "From your last {count} rounds",
	startRound: "Start round",
	resumeTitle: "Round in progress",
	resumeSimulation: "Simulation — not saved",
	resume: "Resume",
	resumeDetail: "Hole {hole} · {n} of {total} played",
	handicapEdit: "Opens your handicap index",
	recentRounds: "Recent rounds",
	allRounds: "All rounds",
	nineHoles: "9 holes",
	noRounds: "No rounds yet",
	noRoundsHint: "Your finished rounds show up here.",
	updateReady: "Update ready",
	updateReadyHint: "Tap to restart Fairway with the new version.",
};

export const homeNl: typeof homeEn = {
	title: "Fairway",
	handicap: "Handicap",
	handicapUnset: "Niet ingesteld",
	handicapUnsetHint: "Vul hem in voor je baanhandicap en nettoscores.",
	wouldBe: "Indicatieve handicap {value}",
	wouldBeHint: "Uit je laatste {count} rondes",
	startRound: "Ronde starten",
	resumeTitle: "Ronde bezig",
	resumeSimulation: "Simulatie — niet opgeslagen",
	resume: "Hervatten",
	resumeDetail: "Hole {hole} · {n} van {total} gespeeld",
	handicapEdit: "Opent je handicapindex",
	recentRounds: "Recente rondes",
	allRounds: "Alle rondes",
	nineHoles: "9 holes",
	noRounds: "Nog geen rondes",
	noRoundsHint: "Je afgeronde rondes verschijnen hier.",
	updateReady: "Update klaar",
	updateReadyHint: "Tik om Fairway met de nieuwe versie te herstarten.",
};

export const coursesEn = {
	title: "Choose course",
	search: "Search courses",
	nearby: "Nearby",
	all: "All courses",
	home: "Home course",
	locating: "Finding courses near you…",
	locationOff: "Turn on location to sort courses by distance.",
	allowLocation: "Allow location",
	locationUnavailable: "Could not find your location.",
	noMatch: "No courses match “{query}”.",
	empty: "No courses yet",
	emptyHint: "Import a course on the web app first.",
};

export const coursesNl: typeof coursesEn = {
	title: "Kies baan",
	search: "Zoek banen",
	nearby: "In de buurt",
	all: "Alle banen",
	home: "Thuisbaan",
	locating: "Banen in de buurt zoeken…",
	locationOff: "Zet locatie aan om banen op afstand te sorteren.",
	allowLocation: "Locatie toestaan",
	locationUnavailable: "Je locatie kon niet worden bepaald.",
	noMatch: "Geen banen gevonden voor “{query}”.",
	empty: "Nog geen banen",
	emptyHint: "Importeer eerst een baan via de webapp.",
};

export const setupEn = {
	holes: "Holes",
	holesHint:
		"Pick one loop for 9 holes, two for 18. The same loop twice is fine.",
	holeCount: "{count} holes · par {par}",
	incomplete:
		"Holes {holes} are missing par or stroke index. Complete them on the web first.",
	tee: "Tee",
	teeDetail: "CR {cr} · slope {slope}",
	format: "Format",
	stableford: "Stableford",
	stroke: "Stroke play",
	players: "Players",
	you: "You",
	guest: "Guest {n}",
	guestName: "Name",
	handicapIndex: "Handicap index",
	playingHandicap: "Playing HCP {value}",
	addGuest: "Add player",
	removeGuest: "Remove {name}",
	start: "Tee off",
	startSimulation: "Start simulation",
	simulationNote:
		"A simulated round: nothing counts for your history, stats or handicap.",
	startError: "Could not start the round.",
	notFound: "Course not found.",
	noTees: "This course has no tees yet. Add one on the web first.",
	myCopy: "My copy",
	suggest: "Suggest a correction",
};

export const suggestEn = {
	title: "Suggest a correction",
	label: "What's wrong?",
	placeholder: "For example: hole 7 is par 4 on the 2025 scorecard.",
	footer:
		"Course data is checked against the club's scorecard and is the same for everyone. We review every suggestion.",
	send: "Send",
	sent: "Thanks — we'll check it.",
	error: "Couldn't send your suggestion.",
};

export const setupNl: typeof setupEn = {
	holes: "Holes",
	holesHint:
		"Kies één lus voor 9 holes, twee voor 18. Twee keer dezelfde lus mag.",
	holeCount: "{count} holes · par {par}",
	incomplete:
		"Bij holes {holes} ontbreekt par of strokeindex. Vul ze eerst aan op het web.",
	tee: "Tee",
	teeDetail: "CR {cr} · slope {slope}",
	format: "Spelvorm",
	stableford: "Stableford",
	stroke: "Strokeplay",
	players: "Spelers",
	you: "Jij",
	guest: "Gast {n}",
	guestName: "Naam",
	handicapIndex: "Handicap",
	playingHandicap: "Playing HCP {value}",
	addGuest: "Speler toevoegen",
	removeGuest: "{name} verwijderen",
	start: "Afslaan",
	startSimulation: "Simulatie starten",
	simulationNote:
		"Een gesimuleerde ronde: niets telt mee voor je historie, statistieken of handicap.",
	startError: "De ronde kon niet worden gestart.",
	notFound: "Baan niet gevonden.",
	noTees: "Deze baan heeft nog geen tees. Voeg er eerst een toe op het web.",
	myCopy: "Mijn kopie",
	suggest: "Correctie voorstellen",
};

export const suggestNl: typeof suggestEn = {
	title: "Correctie voorstellen",
	label: "Wat klopt er niet?",
	placeholder: "Bijvoorbeeld: hole 7 is par 4 op de scorekaart van 2025.",
	footer:
		"Baangegevens worden gecontroleerd met de scorekaart van de club en zijn voor iedereen gelijk. We bekijken elk voorstel.",
	send: "Versturen",
	sent: "Bedankt — we kijken ernaar.",
	error: "Je voorstel kon niet worden verstuurd.",
};

export const simulatorEn = {
	title: "Course simulator",
	intro:
		"Test a course from anywhere: stand wherever you like and play through its holes. Your real round, history, stats and handicap stay untouched.",
	running: "Simulation in progress",
	resume: "Resume",
	pickCourse: "Start on a course",
};

export const simulatorNl: typeof simulatorEn = {
	title: "Baansimulator",
	intro:
		"Test een baan vanaf elke plek: ga staan waar je wilt en speel de holes door. Je echte ronde, historie, statistieken en handicap blijven ongemoeid.",
	running: "Simulatie bezig",
	resume: "Hervatten",
	pickCourse: "Starten op een baan",
};
